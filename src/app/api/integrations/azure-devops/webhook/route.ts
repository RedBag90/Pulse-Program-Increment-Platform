import { type NextRequest, NextResponse } from "next/server";
import type { TenantId } from "@/domain/types";

// ADO Service Hooks sign payloads with HMAC-SHA1 using the shared secret
async function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const expected = signature.replace(/^sha1=/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hex.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hex.length; i++) {
    mismatch |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// Map ADO work item state → Pulse status
const STATE_MAP: Record<string, string> = {
  New: "draft",
  Active: "in_progress",
  Resolved: "done",
  Closed: "done",
  Removed: "cancelled",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

  // We use a system-level db client here since this is a webhook from an external service
  const { createPrismaClient: createSystemClient } = await import("@/server/db/prisma");
  const db = createSystemClient({ userId: "system", tenantId });

  const config = await db.azureDevOpsConfig.findUnique({
    where: { tenantId: tenantId as TenantId },
  });
  if (!config) return NextResponse.json({ error: "Not configured" }, { status: 404 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature");
  const valid = await verifySignature(rawBody, signature, config.webhookSecret);
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let event: {
    eventType?: string;
    resource?: {
      workItemId?: number;
      fields?: {
        "System.WorkItemType"?: { newValue?: string };
        "System.State"?: { newValue?: string };
        "System.Id"?: number;
      };
      id?: number;
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventType, resource } = event;

  // Handle workitem.updated events
  if (eventType === "workitem.updated" && resource) {
    const workItemId = resource.workItemId ?? resource.id ?? resource.fields?.["System.Id"];
    const newState = resource.fields?.["System.State"]?.newValue;
    if (workItemId && newState) {
      const pulseStatus = STATE_MAP[newState];
      if (pulseStatus) {
        await db.initiative.updateMany({
          where: {
            tenantId: tenantId as TenantId,
            externalId: String(workItemId),
            externalSystem: "azure_devops",
            deletedAt: null,
          },
          data: { status: pulseStatus },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
