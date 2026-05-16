import { type NextRequest, NextResponse } from "next/server";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { createPiObjective, listPiObjectives } from "@/server/services/pi-objective";
import { problemJson } from "@/server/http/problem";
import type { TenantId, PiId, TeamId } from "@/domain/types";
import { z } from "zod";
import { isErr } from "@/domain/errors";

const createSchema = z.object({
  piId: z.string().uuid(),
  teamId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  businessValue: z.number().int().min(1).max(10).optional(),
  committed: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const piId = req.nextUrl.searchParams.get("piId");
  const teamId = req.nextUrl.searchParams.get("teamId");
  if (!piId) return problemJson(400, "piId query param required");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const objectives = await listPiObjectives(
    db,
    principal.tenantId,
    piId as PiId,
    teamId ? (teamId as TeamId) : undefined,
  );
  return NextResponse.json(objectives);
}

export async function POST(req: NextRequest) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return problemJson(401, "Unauthorized");

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return problemJson(400, "Validation error", parsed.error.flatten());

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await createPiObjective(db, {
    tenantId: principal.tenantId as TenantId,
    actorId: principal.id,
    piId: parsed.data.piId as PiId,
    teamId: parsed.data.teamId as TeamId,
    title: parsed.data.title,
    description: parsed.data.description,
    businessValue: parsed.data.businessValue,
    committed: parsed.data.committed,
  });

  if (isErr(result)) {
    const e = result.error;
    if (e.kind === "not_found") return problemJson(404, `${e.resourceType} not found`);
    return problemJson(409, e.kind === "conflict" ? e.reason : "Conflict");
  }

  return NextResponse.json(result.value, { status: 201 });
}
