import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, PiId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreatePiInput {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  name: string;
  startDate: Date;
  endDate: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdatePiInput {
  tenantId: TenantId;
  actorId: UserId;
  id: PiId;
  name?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  status?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export type PiStatus = "planned" | "active" | "completed";

export async function createPi(
  db: PrismaClient,
  input: CreatePiInput,
): Promise<Result<{ id: PiId }>> {
  const { tenantId, actorId, artId, name, startDate, endDate, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId } });
      if (!art) {
        return err({ kind: "not_found" as const, resourceType: "Art", id: artId });
      }

      if (endDate <= startDate) {
        return err({
          kind: "conflict" as const,
          reason: "End date must be after start date",
        });
      }

      const pi = await tx.programIncrement.create({
        data: { tenantId, artId, name, startDate, endDate },
      });

      // Auto-generate sprints: one set per team in the ART
      const teams = await tx.team.findMany({ where: { artId, tenantId } });
      if (teams.length > 0) {
        const durationDays = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const sprintCount = Math.ceil(durationDays / 14);
        const sprintData = teams.flatMap((team) =>
          Array.from({ length: sprintCount }, (_, i) => {
            const sprintStart = new Date(startDate);
            sprintStart.setDate(sprintStart.getDate() + i * 14);
            const sprintEnd = new Date(startDate);
            sprintEnd.setDate(sprintEnd.getDate() + (i + 1) * 14 - 1);
            // Cap last sprint end at PI end
            const effectiveEnd = sprintEnd > endDate ? endDate : sprintEnd;
            return {
              tenantId,
              piId: pi.id,
              teamId: team.id,
              indexInPi: i + 1,
              startDate: sprintStart,
              endDate: effectiveEnd,
            };
          }),
        );
        await tx.sprint.createMany({ data: sprintData });
      }

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "program_increment",
        resourceId: pi.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: pi.id as PiId });
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({
          kind: "conflict" as const,
          reason: `PI "${name}" already exists in this ART`,
        });
      }
      throw e;
    });
}

export async function updatePi(db: PrismaClient, input: UpdatePiInput): Promise<Result<void>> {
  const { tenantId, actorId, id, name, startDate, endDate, status, ipAddress, userAgent } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.programIncrement.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "ProgramIncrement", id });
      }

      if (existing.status === "completed" && status !== "completed") {
        return err({
          kind: "conflict" as const,
          reason: "Cannot reopen a completed PI",
        });
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (name !== undefined && name !== existing.name) {
        changes["name"] = { before: existing.name, after: name };
      }
      if (status !== undefined && status !== existing.status) {
        changes["status"] = { before: existing.status, after: status };
      }

      await tx.programIncrement.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(status !== undefined && { status }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "program_increment",
        resourceId: id,
        changes,
        ipAddress,
        userAgent,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listPis(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  return db.programIncrement.findMany({
    where: { tenantId, artId },
    include: {
      _count: { select: { sprints: true, initiatives: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getPi(db: PrismaClient, tenantId: TenantId, id: PiId) {
  return db.programIncrement.findFirst({
    where: { id, tenantId },
    include: {
      art: { select: { id: true, name: true } },
      sprints: {
        orderBy: [{ teamId: "asc" }, { indexInPi: "asc" }],
        select: {
          id: true,
          indexInPi: true,
          startDate: true,
          endDate: true,
          teamId: true,
          team: { select: { id: true, name: true } },
        },
      },
      initiatives: {
        where: { deletedAt: null, level: 1 },
        select: { id: true, title: true, status: true, wsjfComputed: true },
        orderBy: { wsjfComputed: "desc" },
      },
    },
  });
}
