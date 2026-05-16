import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createFeature, listFeatures } from "@/server/services/feature";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import { fibonacci } from "@/domain/schemas/initiative";
import type { ArtId, EpicId, PiId } from "@/domain/types";

const createSchema = z.object({
  parentId: z.string().uuid(),
  artId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  wsjfBusinessValue: fibonacci,
  wsjfTimeCriticality: fibonacci,
  wsjfRiskReduction: fibonacci,
  wsjfJobSize: fibonacci,
  acceptanceCriteria: z.array(z.string().min(1)).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const { searchParams } = new URL(request.url);
  const artId = searchParams.get("artId");
  if (!artId) return unprocessable("artId query parameter is required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  return Response.json(await listFeatures(db, principal.tenantId, artId as ArtId));
}

export async function POST(request: Request): Promise<Response> {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await createFeature(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    parentId: parsed.data.parentId as EpicId,
    artId: parsed.data.artId as ArtId,
    piId: parsed.data.piId as PiId | undefined,
    title: parsed.data.title,
    description: parsed.data.description,
    wsjfBusinessValue: parsed.data.wsjfBusinessValue,
    wsjfTimeCriticality: parsed.data.wsjfTimeCriticality,
    wsjfRiskReduction: parsed.data.wsjfRiskReduction,
    wsjfJobSize: parsed.data.wsjfJobSize,
    acceptanceCriteria: parsed.data.acceptanceCriteria,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    return problemJson(500, "internal_error");
  }

  return Response.json(result.value, { status: 201 });
}
