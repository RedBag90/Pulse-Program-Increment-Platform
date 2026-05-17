import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, PiId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

export type PiObjectiveId = string & { readonly __brand: "PiObjectiveId" };

export interface CreatePiObjectiveInput {
  piId: PiId;
  teamId: TeamId;
  title: string;
  description?: string | undefined;
  businessValue?: number | undefined;
  committed?: boolean | undefined;
}

export interface UpdatePiObjectiveInput {
  id: PiObjectiveId;
  title?: string | undefined;
  description?: string | undefined;
  businessValue?: number | undefined;
  committed?: boolean | undefined;
  /** SAFe fist-of-five confidence vote, 1-5. */
  confidence?: number | undefined;
}

export async function createPiObjective(
  ctx: RequestContext,
  input: CreatePiObjectiveInput,
): Promise<Result<{ id: PiObjectiveId }>> {
  const mctx = toMutationContext(ctx);
  const { piId, teamId, title, description, businessValue, committed } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const pi = await tx.programIncrement.findFirst({
      where: { id: piId, tenantId: mctx.tenantId },
    });
    if (!pi) {
      return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id: piId });
    }

    const team = await tx.team.findFirst({ where: { id: teamId, tenantId: mctx.tenantId } });
    if (!team) return err({ kind: "not_found" as const, resourceType: "Team", id: teamId });

    const objective = await tx.piObjective.create({
      data: {
        tenantId: mctx.tenantId,
        piId,
        teamId,
        title,
        ...(description !== undefined && { description }),
        ...(businessValue !== undefined && { businessValue }),
        ...(committed !== undefined && { committed }),
        createdBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: objective.id as PiObjectiveId },
      audit: {
        action: "pi_objective.created",
        resourceType: "pi_objective",
        resourceId: objective.id,
      },
    });
  });
}

export async function updatePiObjective(
  ctx: RequestContext,
  input: UpdatePiObjectiveInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, description, businessValue, committed, confidence } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.piObjective.findFirst({ where: { id, tenantId: mctx.tenantId } });
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

    return ok({
      result: undefined,
      audit: { action: "pi_objective.updated", resourceType: "pi_objective", resourceId: id },
    });
  });
}

export async function deletePiObjective(
  ctx: RequestContext,
  input: { id: PiObjectiveId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.piObjective.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "PiObjective", id });

    await tx.piObjective.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "pi_objective.deleted", resourceType: "pi_objective", resourceId: id },
    });
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
