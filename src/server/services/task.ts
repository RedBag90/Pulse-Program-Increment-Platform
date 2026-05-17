import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, StoryId, TaskId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import { validateParentLevel } from "@/domain/hierarchy";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

export interface CreateTaskInput {
  parentId: StoryId;
  title: string;
  description?: string | undefined;
  estimateHours?: number | undefined;
}

export interface UpdateTaskInput {
  id: TaskId;
  title?: string | undefined;
  description?: string | undefined;
  estimateHours?: number | undefined;
  status?: string | undefined;
}

export async function createTask(
  ctx: RequestContext,
  input: CreateTaskInput,
): Promise<Result<{ id: TaskId }>> {
  const mctx = toMutationContext(ctx);
  const { parentId, title, description, estimateHours } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const parent = await tx.initiative.findFirst({
      where: { id: parentId, tenantId: mctx.tenantId, deletedAt: null },
    });
    const hierarchy = validateParentLevel(InitiativeLevel.TASK, parent, parentId);
    if (isErr(hierarchy)) return hierarchy;
    const story = parent!; // non-null once validateParentLevel passes

    const path = `${story.path}/${crypto.randomUUID()}`;

    const task = await tx.initiative.create({
      data: {
        tenantId: mctx.tenantId,
        level: InitiativeLevel.TASK,
        parentId,
        path,
        title,
        ...(description !== undefined && { description }),
        ...(estimateHours !== undefined && { estimateHours }),
        ownerId: mctx.actorId,
        assigneeIds: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: task.id as TaskId },
      audit: { action: "initiative.created", resourceType: "initiative", resourceId: task.id },
    });
  });
}

export async function updateTask(
  ctx: RequestContext,
  input: UpdateTaskInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, description, estimateHours, status } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.TASK, deletedAt: null },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Task", id });
    }

    const changes = buildChangelog(
      { status: existing.status },
      { ...(status !== undefined && { status }) },
      ["status"],
    );

    await tx.initiative.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(estimateHours !== undefined && { estimateHours }),
        ...(status !== undefined && { status }),
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.updated", resourceType: "initiative", resourceId: id, changes },
    });
  });
}

export async function deleteTask(
  ctx: RequestContext,
  input: { id: TaskId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.initiative.findFirst({
      where: { id, tenantId: mctx.tenantId, level: InitiativeLevel.TASK, deletedAt: null },
    });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Task", id });

    await tx.initiative.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: { action: "initiative.deleted", resourceType: "initiative", resourceId: id },
    });
  });
}

export async function listTasks(db: PrismaClient, tenantId: TenantId, storyId: StoryId) {
  return db.initiative.findMany({
    where: { tenantId, parentId: storyId, level: InitiativeLevel.TASK, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
