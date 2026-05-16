import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic, updateEpic } from "@/server/services/initiative";
import { authorize } from "@/server/auth/authorize";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { EpicId } from "@/domain/types";

const updateEpicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  leanBusinessCase: z.record(z.unknown()).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epic = await getEpic(db, principal.tenantId, id as EpicId);

  if (!epic) return problemJson(404, "not_found");
  return Response.json(epic);
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const decision = authorize("epic.update", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessable("Invalid JSON body");
  }

  const parsed = updateEpicSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await updateEpic(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: id as EpicId,
    ...parsed.data,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    return problemJson(500, "internal_error");
  }

  return new Response(null, { status: 204 });
}
