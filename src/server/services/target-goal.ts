import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err, isErr } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";
import { findOr404 } from "@/server/services/tenant-scope";
import { notDeleted } from "@/server/db/soft-delete";

/**
 * Strategic transformation goals (Ziele) — the senior-management direction.
 * A goal carries KPIs (TargetOutcome rows with this goalId) and is realised by
 * Epics (GoalEpicLink, n:m). Tenant-scoped, audited, gated via `target.manage`.
 */

export const GOAL_STATUSES = ["active", "achieved", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Goals with their KPIs and linked Epics — backs the Ziele page and cockpit. */
export async function listGoals(db: PrismaClient, tenantId: TenantId) {
  return db.transformationGoal.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    include: {
      kpis: { orderBy: { createdAt: "asc" } },
      epicLinks: {
        include: { epic: { select: { id: true, title: true, status: true } } },
      },
    },
  });
}

/** A single goal with its KPIs and linked Epics — backs the goal detail page. */
export async function getGoal(db: PrismaClient, tenantId: TenantId, id: string) {
  return db.transformationGoal.findFirst({
    where: { id, tenantId },
    include: {
      kpis: { orderBy: { createdAt: "asc" } },
      epicLinks: {
        include: { epic: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export interface SaveGoalInput {
  id?: string | null;
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: Date | null;
  status?: GoalStatus;
}

export async function saveGoal(
  ctx: RequestContext,
  input: SaveGoalInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { id, title, description, ownerId, dueDate, status } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const data = {
      title,
      description: description ?? null,
      ownerId: ownerId ?? null,
      dueDate: dueDate ?? null,
      ...(status !== undefined && { status }),
      updatedBy: mctx.actorId,
    };

    if (id) {
      const found = await findOr404(tx.transformationGoal, {
        id,
        tenantId: mctx.tenantId,
        resourceType: "Goal",
      });
      if (isErr(found)) return found;
      const row = await tx.transformationGoal.update({ where: { id }, data });
      return ok({
        result: { id: row.id },
        audit: {
          action: "transformation_goal.updated",
          resourceType: "transformation_goal",
          resourceId: row.id,
        },
      });
    }

    const row = await tx.transformationGoal.create({
      data: { ...data, tenantId: mctx.tenantId, createdBy: mctx.actorId },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "transformation_goal.created",
        resourceType: "transformation_goal",
        resourceId: row.id,
      },
    });
  });
}

export async function deleteGoal(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;
  return withAuditedTransaction(mctx, async (tx) => {
    const found = await findOr404(tx.transformationGoal, {
      id,
      tenantId: mctx.tenantId,
      resourceType: "Goal",
    });
    if (isErr(found)) return found;

    // FKs handle the rest: KPIs (TargetOutcome.goalId) → SET NULL, links → CASCADE.
    await tx.transformationGoal.delete({ where: { id } });
    return ok({
      result: undefined,
      audit: {
        action: "transformation_goal.deleted",
        resourceType: "transformation_goal",
        resourceId: id,
      },
    });
  });
}

export async function linkGoalEpic(
  ctx: RequestContext,
  input: { goalId: string; epicId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { goalId, epicId } = input;

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const goal = await findOr404(tx.transformationGoal, {
        id: goalId,
        tenantId: mctx.tenantId,
        resourceType: "Goal",
      });
      if (isErr(goal)) return goal;

      const epic = await tx.initiative.findFirst({
        where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC, ...notDeleted },
      });
      if (!epic) return err({ kind: "not_found" as const, resourceType: "Epic", id: epicId });

      await tx.goalEpicLink.create({
        data: { tenantId: mctx.tenantId, goalId, epicId, createdBy: mctx.actorId },
      });
      return ok({
        result: undefined,
        audit: { action: "goal_epic.linked", resourceType: "goal_epic_link", resourceId: goalId },
      });
    },
    { onPrismaError: onUniqueConstraint("Dieses Epic ist bereits mit dem Ziel verknüpft") },
  );
}

export async function unlinkGoalEpic(
  ctx: RequestContext,
  input: { goalId: string; epicId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { goalId, epicId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.goalEpicLink.findFirst({
      where: { goalId, epicId, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({
        kind: "not_found" as const,
        resourceType: "GoalEpicLink",
        id: `${goalId}:${epicId}`,
      });
    }
    await tx.goalEpicLink.delete({ where: { id: existing.id } });
    return ok({
      result: undefined,
      audit: { action: "goal_epic.unlinked", resourceType: "goal_epic_link", resourceId: goalId },
    });
  });
}
