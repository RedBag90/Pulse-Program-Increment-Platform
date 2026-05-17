import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import { generateSprints } from "@/domain/pi-planning";
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

      // Backfill sprints: a team added after a PI was created still needs the PI's
      // sprints. Mirrors createPi, which only covers teams existing at PI creation.
      // Only planned PIs — an active/completed PI's sprint set is frozen.
      const plannedPis = await tx.programIncrement.findMany({
        where: { tenantId: mctx.tenantId, artId, status: "planned" },
      });
      for (const pi of plannedPis) {
        const drafts = generateSprints(pi.startDate, pi.endDate, [{ id: team.id }]);
        await tx.sprint.createMany({
          data: drafts.map((s) => ({ tenantId: mctx.tenantId, piId: pi.id, ...s })),
        });
      }

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
  const { id, name, description, headcount, targetVelocity } = input;

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
        },
        {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(headcount !== undefined && { headcount }),
          ...(targetVelocity !== undefined && { targetVelocity }),
        },
        ["name", "description", "headcount", "targetVelocity"],
      );

      await tx.team.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(headcount !== undefined && { headcount }),
          ...(targetVelocity !== undefined && { targetVelocity }),
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
      include: { _count: { select: { sprints: true } } },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Team", id });

    if (existing._count.sprints > 0) {
      return err({ kind: "conflict" as const, reason: "Team has active sprints" });
    }

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
    include: { _count: { select: { sprints: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getTeam(db: PrismaClient, tenantId: TenantId, id: TeamId) {
  return db.team.findFirst({
    where: { id, tenantId },
    include: { art: { select: { id: true, name: true } } },
  });
}
