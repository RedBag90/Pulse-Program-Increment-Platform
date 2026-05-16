import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, TeamId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreateTeamInput {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  name: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateTeamInput {
  tenantId: TenantId;
  actorId: UserId;
  id: TeamId;
  name?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createTeam(
  db: PrismaClient,
  input: CreateTeamInput,
): Promise<Result<{ id: TeamId }>> {
  const { tenantId, actorId, artId, name, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId } });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
      }

      const team = await tx.team.create({ data: { tenantId, artId, name } });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "team.created",
        resourceType: "team",
        resourceId: team.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: team.id as TeamId });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `Team "${name}" already exists` });
      }
      throw e;
    });
}

export async function updateTeam(db: PrismaClient, input: UpdateTeamInput): Promise<Result<void>> {
  const { tenantId, actorId, id, name, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.team.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Team", id });
      }

      await tx.team.update({
        where: { id },
        data: { ...(name !== undefined && { name }) },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "team.updated",
        resourceType: "team",
        resourceId: id,
        changes: name !== undefined ? { name: { before: existing.name, after: name } } : {},
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({ kind: "conflict" as const, reason: `Team "${name}" already exists` });
      }
      throw e;
    });
}

export async function deleteTeam(
  db: PrismaClient,
  tenantId: TenantId,
  id: TeamId,
  actorId: UserId,
  ipAddress?: string | undefined,
  userAgent?: string | undefined,
): Promise<Result<void>> {
  return db
    .$transaction(async (tx) => {
      const existing = await tx.team.findFirst({
        where: { id, tenantId },
        include: { _count: { select: { sprints: true } } },
      });
      if (!existing) return err({ kind: "not_found" as const, resourceType: "Team", id });

      if (existing._count.sprints > 0) {
        return err({ kind: "conflict" as const, reason: "Team has active sprints" });
      }

      await tx.team.delete({ where: { id } });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "team.deleted",
        resourceType: "team",
        resourceId: id,
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listTeams(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  return db.team.findMany({
    where: { tenantId, artId },
    include: { _count: { select: { sprints: true } } },
    orderBy: { name: "asc" },
  });
}
