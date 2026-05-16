import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { updateValueStream, softDeleteValueStream } from "@/server/services/value-stream";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { ValueStreamId } from "@/domain/types";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  budgetAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  budgetCurrency: z.string().length(3).optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const vs = await db.valueStream.findFirst({
    where: { id, tenantId: principal.tenantId },
    include: { arts: true },
  });

  if (!vs) return problemJson(404, "not_found");
  return Response.json(vs);
}

export async function PATCH(request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");
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

  const result = await updateValueStream(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: id as ValueStreamId,
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

export async function DELETE(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");
  if (!canEdit) return forbidden();

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await softDeleteValueStream(
    db,
    principal.tenantId,
    id as ValueStreamId,
    principal.id,
    ipAddress,
    userAgent,
  );

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    return problemJson(500, "internal_error");
  }

  return new Response(null, { status: 204 });
}
