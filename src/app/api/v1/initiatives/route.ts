import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createEpic, listEpics } from "@/server/services/initiative";
import { authorize } from "@/server/auth/authorize";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { ValueStreamId } from "@/domain/types";

const createEpicSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  valueStreamId: z.string().uuid(),
  leanBusinessCase: z.record(z.unknown()).optional(),
});

export async function GET(_request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await listEpics(db, principal.tenantId);
  return Response.json(epics);
}

export async function POST(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const decision = authorize("epic.create", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessable("Invalid JSON body");
  }

  const parsed = createEpicSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createEpic(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    title: parsed.data.title,
    description: parsed.data.description,
    valueStreamId: parsed.data.valueStreamId as ValueStreamId,
    leanBusinessCase: parsed.data.leanBusinessCase,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found")
      return problemJson(404, "not_found", { detail: `ValueStream ${result.error.id} not found` });
    return problemJson(500, "internal_error");
  }

  return Response.json(result.value, { status: 201 });
}
