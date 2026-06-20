import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";

export interface CreateTeamInput {
  artId: ArtId;
  name: string;
}

export interface UpdateTeamInput {
  id: TeamId;
  name?: string | undefined;
  description?: string | undefined;
  headcount?: number | undefined;
  targetVelocity?: number | undefined;
  scrumMasterId?: string | null | undefined;
  productOwnerId?: string | null | undefined;
  teamType?: string | null | undefined;
}

export async function createTeam(
  ctx: RequestContext,
  input: CreateTeamInput,
): Promise<Result<{ id: TeamId }>> {
  const mctx = toMutationContext(ctx);
  const { artId, name } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
      }

      const team = await tx.team.create({ data: { tenantId: mctx.tenantId, artId, name } });

      return ok({
        result: { id: team.id as TeamId },
        audit: { action: "team.created", resourceType: "team", resourceId: team.id },
      });
    },
    { onPrismaError: onUniqueConstraint(`Team "${name}" already exists`) },
  );
}

export async function updateTeam(
  ctx: RequestContext,
  input: UpdateTeamInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const {
    id,
    name,
    description,
    headcount,
    targetVelocity,
    scrumMasterId,
    productOwnerId,
    teamType,
  } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const existing = await tx.team.findFirst({ where: { id, tenantId: mctx.tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Team", id });
      }

      const changes = buildChangelog(
        {
          name: existing.name,
          description: existing.description,
          headcount: existing.headcount,
          targetVelocity: existing.targetVelocity,
          scrumMasterId: existing.scrumMasterId,
          productOwnerId: existing.productOwnerId,
          teamType: existing.teamType,
        },
        {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(headcount !== undefined && { headcount }),
          ...(targetVelocity !== undefined && { targetVelocity }),
          ...(scrumMasterId !== undefined && { scrumMasterId }),
          ...(productOwnerId !== undefined && { productOwnerId }),
          ...(teamType !== undefined && { teamType }),
        },
        [
          "name",
          "description",
          "headcount",
          "targetVelocity",
          "scrumMasterId",
          "productOwnerId",
          "teamType",
        ],
      );

      await tx.team.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(headcount !== undefined && { headcount }),
          ...(targetVelocity !== undefined && { targetVelocity }),
          ...(scrumMasterId !== undefined && { scrumMasterId }),
          ...(productOwnerId !== undefined && { productOwnerId }),
          ...(teamType !== undefined && { teamType }),
        },
      });

      return ok({
        result: undefined,
        audit: { action: "team.updated", resourceType: "team", resourceId: id, changes },
      });
    },
    { onPrismaError: onUniqueConstraint(`Team "${name}" already exists`) },
  );
}

export async function deleteTeam(
  ctx: RequestContext,
  input: { id: TeamId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.team.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Team", id });

    await tx.team.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "team.deleted", resourceType: "team", resourceId: id },
    });
  });
}

export async function listTeams(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  return db.team.findMany({
    where: { tenantId, artId },
    orderBy: { name: "asc" },
  });
}

export async function getTeam(db: PrismaClient, tenantId: TenantId, id: TeamId) {
  return db.team.findFirst({
    where: { id, tenantId },
    include: { art: { select: { id: true, name: true } } },
  });
}
