import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, StoryId, TaskId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";

export interface CreateTaskInput {
  tenantId: TenantId;
  actorId: UserId;
  parentId: StoryId;
  title: string;
  description?: string | undefined;
  estimateHours?: number | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface UpdateTaskInput {
  tenantId: TenantId;
  actorId: UserId;
  id: TaskId;
  title?: string | undefined;
  description?: string | undefined;
  estimateHours?: number | undefined;
  status?: string | undefined;
}

export async function createTask(
  db: PrismaClient,
  input: CreateTaskInput,
): Promise<Result<{ id: TaskId }>> {
  const { tenantId, actorId, parentId, title, description, estimateHours, ipAddress, userAgent } =
    input;

  return db
    .$transaction(async (tx) => {
      const story = await tx.initiative.findFirst({
        where: { id: parentId, tenantId, level: InitiativeLevel.STORY, deletedAt: null },
      });
      if (!story) {
        return err({ kind: "not_found" as const, resourceType: "Story", id: parentId });
      }

      const path = `${story.path}/${crypto.randomUUID()}`;

      const task = await tx.initiative.create({
        data: {
          tenantId,
          level: InitiativeLevel.TASK,
          parentId,
          path,
          title,
          ...(description !== undefined && { description }),
          ...(estimateHours !== undefined && { estimateHours }),
          ownerId: actorId,
          assigneeIds: [],
          createdBy: actorId,
          updatedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.created",
        resourceType: "initiative",
        resourceId: task.id,
        ipAddress,
        userAgent,
      });

      return ok({ id: task.id as TaskId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function updateTask(db: PrismaClient, input: UpdateTaskInput): Promise<Result<void>> {
  const { tenantId, actorId, id, title, description, estimateHours, status } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.initiative.findFirst({
        where: { id, tenantId, level: InitiativeLevel.TASK, deletedAt: null },
      });
      if (!existing) {
        return err({ kind: "not_found" as const, resourceType: "Task", id });
      }

      const changes: Record<string, { before: unknown; after: unknown }> = {};
      if (status !== undefined && status !== existing.status) {
        changes["status"] = { before: existing.status, after: status };
      }

      await tx.initiative.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(estimateHours !== undefined && { estimateHours }),
          ...(status !== undefined && { status }),
          updatedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "initiative.updated",
        resourceType: "initiative",
        resourceId: id,
        changes,
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listTasks(db: PrismaClient, tenantId: TenantId, storyId: StoryId) {
  return db.initiative.findMany({
    where: { tenantId, parentId: storyId, level: InitiativeLevel.TASK, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteTask(
  db: PrismaClient,
  tenantId: TenantId,
  actorId: UserId,
  id: TaskId,
): Promise<Result<void>> {
  const existing = await db.initiative.findFirst({
    where: { id, tenantId, level: InitiativeLevel.TASK, deletedAt: null },
  });
  if (!existing) return err({ kind: "not_found" as const, resourceType: "Task", id });

  await db.initiative.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actorId },
  });

  return ok(undefined);
}
