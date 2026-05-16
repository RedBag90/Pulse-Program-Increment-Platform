import type { PrismaClient, Prisma } from "@/generated/prisma";
import type { TenantId, UserId, EpicId, ValueStreamId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

// ---------------------------------------------------------------------------
// Create Epic (level 0)
// ---------------------------------------------------------------------------

export interface CreateEpicInput {
  tenantId: TenantId;
  actorId: UserId;
  title: string;
  description?: string | undefined;
  valueStreamId: ValueStreamId;
  leanBusinessCase?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function createEpic(
  db: PrismaClient,
  input: CreateEpicInput,
): Promise<Result<{ id: EpicId }>> {
  const {
    tenantId,
    actorId,
    title,
    description,
    valueStreamId,
    leanBusinessCase,
    ipAddress,
    userAgent,
  } = input;

  return db
    .$transaction(async (tx) => {
      // Verify the value stream belongs to the same tenant (cross-tenant guard)
      const vs = await tx.valueStream.findFirst({ where: { id: valueStreamId, tenantId } });
      if (!vs) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
      }

      const epic = await tx.initiative.create({
        data: {
          tenantId,
          level: InitiativeLevel.EPIC,
          title,
          path: "", // Will be updated after ID is known
          ownerId: actorId,
          assigneeIds: [],
          createdBy: actorId,
          updatedBy: actorId,
          valueStreamId,
          ...(description !== undefined && { description }),
          ...(leanBusinessCase !== undefined && {
            leanBusinessCase: leanBusinessCase as Prisma.InputJsonValue,
          }),
        },
      });

      // Materialized path: root level epics just use their own ID
      await tx.initiative.update({
        where: { id: epic.id },
        data: { path: epic.id },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "initiative",
        resourceId: epic.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: epic.id as EpicId });
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.message.includes("not_found")) {
        return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
      }
      throw e;
    });
}

// ---------------------------------------------------------------------------
// Update Epic
// ---------------------------------------------------------------------------

export interface UpdateEpicInput {
  tenantId: TenantId;
  actorId: UserId;
  id: EpicId;
  title?: string | undefined;
  description?: string | undefined;
  leanBusinessCase?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export async function updateEpic(db: PrismaClient, input: UpdateEpicInput): Promise<Result<void>> {
  const { tenantId, actorId, id, title, description, leanBusinessCase, ipAddress, userAgent } =
    input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.initiative.findFirst({
        where: { id, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      });

      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Epic", id });
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (title !== undefined && title !== existing.title) {
        changes["title"] = { before: existing.title, after: title };
      }
      if (description !== undefined && description !== existing.description) {
        changes["description"] = { before: existing.description, after: description };
      }

      await tx.initiative.update({
        where: { id },
        data: {
          updatedBy: actorId,
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(leanBusinessCase !== undefined && {
            leanBusinessCase: leanBusinessCase as Prisma.InputJsonValue,
          }),
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "initiative",
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

// ---------------------------------------------------------------------------
// List Epics
// ---------------------------------------------------------------------------

export async function listEpics(db: PrismaClient, tenantId: TenantId) {
  return db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: { valueStream: { select: { id: true, name: true } } },
    orderBy: [{ stageGate: "asc" }, { createdAt: "desc" }],
  });
}

// ---------------------------------------------------------------------------
// Get Epic by ID
// ---------------------------------------------------------------------------

export async function getEpic(db: PrismaClient, tenantId: TenantId, id: EpicId) {
  return db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    include: {
      valueStream: { select: { id: true, name: true } },
      children: {
        where: { deletedAt: null },
        select: { id: true, title: true, level: true, status: true },
      },
    },
  });
}
