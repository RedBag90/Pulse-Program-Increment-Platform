import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getFeature, updateFeature } from "@/server/services/feature";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import { fibonacci } from "@/domain/schemas/initiative";
import type { FeatureId, PiId } from "@/domain/types";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  wsjfBusinessValue: fibonacci.optional(),
  wsjfTimeCriticality: fibonacci.optional(),
  wsjfRiskReduction: fibonacci.optional(),
  wsjfJobSize: fibonacci.optional(),
  acceptanceCriteria: z.array(z.string().min(1)).optional(),
  piId: z.string().uuid().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const feature = await getFeature(db, principal.tenantId, id as FeatureId);
  if (!feature) return problemJson(404, "not_found");
  return Response.json(feature);
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

  const result = await updateFeature(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    id: id as FeatureId,
    ...parsed.data,
    piId: parsed.data.piId as PiId | undefined,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    return problemJson(500, "internal_error");
  }

  return new Response(null, { status: 204 });
}
