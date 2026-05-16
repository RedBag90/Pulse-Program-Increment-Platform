import { type NextRequest, NextResponse } from "next/server";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";
import { InitiativeLevel } from "@/domain/types";

// Jira sends the HMAC-SHA256 signature in this header
const SIGNATURE_HEADER = "x-hub-signature";

async function verifySignature(
  body: string,
  secret: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Header format: "sha256=<hex>"
  const [algo, hex] = signatureHeader.split("=");
  if (algo !== "sha256" || !hex) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (computed.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ hex.charCodeAt(i);
  }
  return diff === 0;
}

// Jira status category keys → Pulse story status
const STATUS_MAP: Record<string, string> = {
  new: "draft",
  indeterminate: "in_progress",
  done: "done",
};

interface JiraWebhookBody {
  webhookEvent?: string;
  issue?: {
    key?: string;
    fields?: {
      status?: {
        statusCategory?: { key?: string };
      };
    };
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);

  // We need to identify the tenant from the issue key or a query param.
  // Jira doesn't send tenant info natively, so we use a `tenantId` query
  // param appended to the webhook URL during registration.
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return problemJson(400, "Missing tenantId query param");

  // Use system-level db to look up the webhook secret without user context
  const db = createPrismaClient({ userId: "system", tenantId } as never);

  const config = await db.jiraConfig.findUnique({ where: { tenantId } });
  if (!config) return problemJson(404, "No Jira config for this tenant");

  const valid = await verifySignature(rawBody, config.webhookSecret, signature);
  if (!valid) return problemJson(401, "Invalid signature");

  let body: JiraWebhookBody;
  try {
    body = JSON.parse(rawBody) as JiraWebhookBody;
  } catch {
    return problemJson(400, "Invalid JSON");
  }

  const event = body.webhookEvent;
  if (event !== "jira:issue_updated" && event !== "jira:issue_created") {
    // Acknowledge unknown events without processing
    return new NextResponse(null, { status: 204 });
  }

  const issueKey = body.issue?.key;
  const statusCategoryKey = body.issue?.fields?.status?.statusCategory?.key;

  if (!issueKey) return new NextResponse(null, { status: 204 });

  // Look up the story by its external Jira key
  const story = await db.initiative.findFirst({
    where: {
      tenantId,
      externalId: issueKey,
      externalSystem: "jira",
      level: InitiativeLevel.STORY,
      deletedAt: null,
    },
  });

  if (!story) return new NextResponse(null, { status: 204 }); // unknown issue — ignore

  if (statusCategoryKey) {
    const newStatus = STATUS_MAP[statusCategoryKey];
    if (newStatus && newStatus !== story.status) {
      await db.initiative.update({
        where: { id: story.id },
        data: { status: newStatus, updatedBy: story.createdBy },
      });
    }
  }

  return new NextResponse(null, { status: 204 });
}
