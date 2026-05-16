import { z } from "zod";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { linkDependency, unlinkDependency, listDependencies } from "@/server/services/dependency";
import { forbidden, unprocessable, problemJson } from "@/server/http/problem";
import { extractRequestMeta } from "@/server/audit/emit";
import { headers } from "next/headers";
import { isErr } from "@/domain/errors";
import type { InitiativeId } from "@/domain/types";

const dependencyTypeSchema = z.enum(["blocks", "depends_on", "relates_to"]);

const linkSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  type: dependencyTypeSchema,
});

const unlinkSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  type: dependencyTypeSchema,
});

export async function GET(request: Request): Promise<Response> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "unauthorized");

  const { searchParams } = new URL(request.url);
  const initiativeId = searchParams.get("initiativeId");
  if (!initiativeId) return unprocessable("initiativeId query parameter is required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  return Response.json(
    await listDependencies(db, principal.tenantId, initiativeId as InitiativeId),
  );
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

  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await linkDependency(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    fromId: parsed.data.fromId as InitiativeId,
    toId: parsed.data.toId as InitiativeId,
    type: parsed.data.type,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    if (result.error.kind === "conflict")
      return problemJson(409, "conflict", { detail: result.error.reason });
    return problemJson(500, "internal_error");
  }

  return Response.json(result.value, { status: 201 });
}

export async function DELETE(request: Request): Promise<Response> {
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

  const parsed = unlinkSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error.message);

  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const result = await unlinkDependency(db, {
    tenantId: principal.tenantId,
    actorId: principal.id,
    fromId: parsed.data.fromId as InitiativeId,
    toId: parsed.data.toId as InitiativeId,
    type: parsed.data.type,
    ipAddress,
    userAgent,
  });

  if (isErr(result)) {
    if (result.error.kind === "not_found") return problemJson(404, "not_found");
    return problemJson(500, "internal_error");
  }

  return new Response(null, { status: 204 });
}
