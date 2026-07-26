import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { recordedUpdate } from "@/server/services/recorded-update";
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

      const { changes, data } = recordedUpdate({
        existing,
        updates: {
          name,
          description,
          headcount,
          targetVelocity,
          scrumMasterId,
          productOwnerId,
          teamType,
        },
        fields: [
          "name",
          "description",
          "headcount",
          "targetVelocity",
          "scrumMasterId",
          "productOwnerId",
          "teamType",
        ] as const,
      });

      await tx.team.update({ where: { id }, data });

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

/** Alle Teams eines Tenants (ART-übergreifend) — für den Goal-„Accountable team"-Picker. */
export async function listTenantTeams(db: PrismaClient, tenantId: TenantId) {
  return db.team.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getTeam(db: PrismaClient, tenantId: TenantId, id: TeamId) {
  return db.team.findFirst({
    where: { id, tenantId },
    include: { art: { select: { id: true, name: true } } },
  });
}
