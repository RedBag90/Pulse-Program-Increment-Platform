import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import {
  escalateImpediment,
  resolveImpediment,
  type ImpedimentId,
} from "@/server/services/impediment";
import type { RequestContext } from "@/server/http/mutation-handler";
import { authorize } from "@/server/auth/authorize";
import { forbidden, problemJson } from "@/server/http/problem";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("escalate") }),
  z.object({ action: z.literal("resolve"), resolution: z.string().min(1).max(5000) }),
]);

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const decision = authorize(
    parsed.data.action === "escalate" ? "impediment.escalate" : "impediment.resolve",
    { tenantId: principal.tenantId },
    principal,
  );
  if (!decision.allow) return forbidden(decision.reason);

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const ctx: RequestContext = {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };

  let result;
  if (parsed.data.action === "escalate") {
    result = await escalateImpediment(ctx, { id: id as ImpedimentId });
  } else {
    result = await resolveImpediment(ctx, {
      id: id as ImpedimentId,
      resolution: parsed.data.resolution,
    });
  }

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, "Impediment not found");
    return problemJson(409, e.kind === "conflict" ? e.reason : "Conflict");
  }

  return new NextResponse(null, { status: 204 });
}
