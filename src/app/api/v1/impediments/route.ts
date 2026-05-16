import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createImpediment, listImpediments } from "@/server/services/impediment";
import { authorize } from "@/server/auth/authorize";
import { forbidden, problemJson } from "@/server/http/problem";
import type { TenantId, ArtId, PiId, SprintId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const createSchema = z.object({
  artId: z.string().uuid(),
  piId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const artId = req.nextUrl.searchParams.get("artId");
  if (!artId) return problemJson(400, "artId query param required");

  const piId = req.nextUrl.searchParams.get("piId") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const impediments = await listImpediments(db, principal.tenantId as TenantId, artId as ArtId, {
    ...(piId !== undefined && { piId }),
    ...(status !== undefined && { status }),
  });
  return NextResponse.json(impediments);
}

export async function POST(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const decision = authorize("impediment.create", { tenantId: principal.tenantId }, principal);
  if (!decision.allow) return forbidden(decision.reason);

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createImpediment(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    artId: parsed.data.artId as ArtId,
    piId: parsed.data.piId as PiId | undefined,
    sprintId: parsed.data.sprintId as SprintId | undefined,
    title: parsed.data.title,
    description: parsed.data.description,
    severity: parsed.data.severity,
  });

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, `${e.resourceType} not found`);
    return problemJson(409, e.kind === "conflict" ? e.reason : "Conflict");
  }

  return NextResponse.json(result.value, { status: 201 });
}
