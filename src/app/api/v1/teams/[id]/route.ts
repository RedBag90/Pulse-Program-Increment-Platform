import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { updateTeam } from "@/server/services/team";
import { authorize } from "@/server/auth/authorize";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { TeamId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const decision = authorize("team.update", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessable("Invalid JSON body");
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await updateTeam(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: id as TeamId,
    ...parsed.data,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    if (result.error.kind === "conflict")
      return problemJson(409, "conflict", { detail: result.error.reason });
    return problemJson(500, "internal_error");
  }

  return new Response(null, { status: 204 });
}
