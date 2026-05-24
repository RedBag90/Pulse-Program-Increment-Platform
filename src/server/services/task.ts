import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, StoryId, TaskId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import { buildChangelog } from "@/domain/change-log";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import {
  findValidatedParent,
  createChildInitiative,
  findInitiativeAtLevel,
  softDeleteInitiativeAtLevel,
} from "@/server/services/initiative-write";

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
    const parentResult = await findValidatedParent(tx, mctx, InitiativeLevel.TASK, parentId);
    if (isErr(parentResult)) return parentResult;
    const story = parentResult.value!; // non-null for a TASK's STORY parent

    const task = await createChildInitiative(tx, mctx, {
      level: InitiativeLevel.TASK,
      parentId,
      parentPath: story.path,
      title,
      data: {
        ...(description !== undefined && { description }),
        ...(estimateHours !== undefined && { estimateHours }),
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
    const found = await findInitiativeAtLevel(tx, mctx, {
      id,
      level: InitiativeLevel.TASK,
      resourceType: "Task",
    });
    if (isErr(found)) return found;
    const existing = found.value;

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

  return withAuditedTransaction(mctx, (tx) =>
    softDeleteInitiativeAtLevel(tx, mctx, {
      id,
      level: InitiativeLevel.TASK,
      resourceType: "Task",
    }),
  );
}

export async function listTasks(db: PrismaClient, tenantId: TenantId, storyId: StoryId) {
  return db.initiative.findMany({
    where: { tenantId, parentId: storyId, level: InitiativeLevel.TASK, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
