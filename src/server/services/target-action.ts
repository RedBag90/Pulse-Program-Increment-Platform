import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/**
 * Transformation actions — the tracked "Steuern" backlog that moves the
 * organisation from Ist toward the Soll. Tenant-scoped, audited.
 */

export const ACTION_STATUSES = ["open", "in_progress", "done"] as const;
export type TransformationActionStatus = (typeof ACTION_STATUSES)[number];

export async function listTransformationActions(db: PrismaClient, tenantId: TenantId) {
  return db.transformationAction.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
}

export interface CreateTransformationActionInput {
  title: string;
  ownerId?: string | null;
  dueDate?: Date | null;
}

export async function createTransformationAction(
  ctx: RequestContext,
  input: CreateTransformationActionInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.transformationAction.create({
      data: {
        tenantId: mctx.tenantId,
        title: input.title,
        ownerId: input.ownerId ?? null,
        dueDate: input.dueDate ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "transformation_action.created",
        resourceType: "transformation_action",
        resourceId: row.id,
      },
    });
  });
}

export interface UpdateTransformationActionInput {
  id: string;
  title?: string | undefined;
  status?: TransformationActionStatus | undefined;
  ownerId?: string | null | undefined;
  dueDate?: Date | null | undefined;
}

export async function updateTransformationAction(
  ctx: RequestContext,
  input: UpdateTransformationActionInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, status, ownerId, dueDate } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.transformationAction.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "TransformationAction", id });
    }

    await tx.transformationAction.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(status !== undefined && { status }),
        ...(ownerId !== undefined && { ownerId }),
        ...(dueDate !== undefined && { dueDate }),
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "transformation_action.updated",
        resourceType: "transformation_action",
        resourceId: id,
      },
    });
  });
}

export async function deleteTransformationAction(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;
  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.transformationAction.findFirst({
      where: { id, tenantId: mctx.tenantId },
    });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "TransformationAction", id });
    }
    await tx.transformationAction.delete({ where: { id } });
    return ok({
      result: undefined,
      audit: {
        action: "transformation_action.deleted",
        resourceType: "transformation_action",
        resourceId: id,
      },
    });
  });
}
