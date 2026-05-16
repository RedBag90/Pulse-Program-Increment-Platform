import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, PiId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export type PiObjectiveId = string & { readonly __brand: "PiObjectiveId" };

export interface CreatePiObjectiveInput {
  tenantId: TenantId;
  actorId: UserId;
  piId: PiId;
  teamId: TeamId;
  title: string;
  description?: string | undefined;
  businessValue?: number | undefined;
  committed?: boolean | undefined;
}

export interface UpdatePiObjectiveInput {
  tenantId: TenantId;
  actorId: UserId;
  id: PiObjectiveId;
  title?: string | undefined;
  description?: string | undefined;
  businessValue?: number | undefined;
  committed?: boolean | undefined;
  /** SAFe fist-of-five confidence vote, 1-5. */
  confidence?: number | undefined;
}

export async function createPiObjective(
  db: PrismaClient,
  input: CreatePiObjectiveInput,
): Promise<Result<{ id: PiObjectiveId }>> {
  const { tenantId, actorId, piId, teamId, title, description, businessValue, committed } = input;

  return db
    .$transaction(async (tx) => {
      const pi = await tx.programIncrement.findFirst({ where: { id: piId, tenantId } });
      if (!pi)
        return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id: piId });

      const team = await tx.team.findFirst({ where: { id: teamId, tenantId } });
      if (!team) return err({ kind: "not_found" as const, resourceType: "Team", id: teamId });

      const objective = await tx.piObjective.create({
        data: {
          tenantId,
          piId,
          teamId,
          title,
          ...(description !== undefined && { description }),
          ...(businessValue !== undefined && { businessValue }),
          ...(committed !== undefined && { committed }),
          createdBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "pi_objective.created",
        resourceType: "pi_objective",
        resourceId: objective.id,
      });

      return ok({ id: objective.id as PiObjectiveId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function updatePiObjective(
  db: PrismaClient,
  input: UpdatePiObjectiveInput,
): Promise<Result<void>> {
  const { tenantId, actorId, id, title, description, businessValue, committed, confidence } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.piObjective.findFirst({ where: { id, tenantId } });
      if (!existing) return err({ kind: "not_found" as const, resourceType: "PiObjective", id });

      await tx.piObjective.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(businessValue !== undefined && { businessValue }),
          ...(committed !== undefined && { committed }),
          ...(confidence !== undefined && { confidence }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "pi_objective.updated",
        resourceType: "pi_objective",
        resourceId: id,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listPiObjectives(
  db: PrismaClient,
  tenantId: TenantId,
  piId: PiId,
  teamId?: TeamId,
) {
  return db.piObjective.findMany({
    where: { tenantId, piId, ...(teamId !== undefined && { teamId }) },
    include: { team: { select: { id: true, name: true } } },
    orderBy: [{ teamId: "asc" }, { createdAt: "asc" }],
  });
}

export async function deletePiObjective(
  db: PrismaClient,
  tenantId: TenantId,
  id: PiObjectiveId,
): Promise<Result<void>> {
  const existing = await db.piObjective.findFirst({ where: { id, tenantId } });
  if (!existing) return err({ kind: "not_found" as const, resourceType: "PiObjective", id });
  await db.piObjective.delete({ where: { id } });
  return ok(undefined);
}
