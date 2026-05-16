import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getPi, updatePi } from "@/server/services/pi";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { PiId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(["planned", "active", "completed"]).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const pi = await getPi(db, principal.tenantId, id as PiId);
  if (!pi) return problemJson(404, "not_found");
  return Response.json(pi);
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const canEdit =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canEdit) return forbidden();

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

  const result = await updatePi(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: id as PiId,
    ...parsed.data,
    startDate: parsed.data.startDate !== undefined ? new Date(parsed.data.startDate) : undefined,
    endDate: parsed.data.endDate !== undefined ? new Date(parsed.data.endDate) : undefined,
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
