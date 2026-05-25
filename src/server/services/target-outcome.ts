import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { findOr404 } from "@/server/services/tenant-scope";

/**
 * Organisation-wide target outcomes (OKRs) — the business part of the Soll.
 * Tenant-scoped, audited. Distinct from Epic KPIs and PI Objectives.
 */

export async function listTargetOutcomes(db: PrismaClient, tenantId: TenantId) {
  return db.targetOutcome.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
}

export interface SaveTargetOutcomeInput {
  id?: string | null;
  goalId?: string | null;
  title: string;
  metricUnit?: string | null;
  baseline?: number | null;
  target: number;
  current?: number | null;
  dueDate?: Date | null;
}

export async function saveTargetOutcome(
  ctx: RequestContext,
  input: SaveTargetOutcomeInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { id, goalId, title, metricUnit, baseline, target, current, dueDate } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const data = {
      title,
      metricUnit: metricUnit ?? null,
      baseline: baseline ?? null,
      target,
      current: current ?? null,
      dueDate: dueDate ?? null,
      ...(goalId !== undefined && { goalId }),
      updatedBy: mctx.actorId,
    };

    if (id) {
      const found = await findOr404(tx.targetOutcome, {
        id,
        tenantId: mctx.tenantId,
        resourceType: "TargetOutcome",
      });
      if (isErr(found)) return found;
      const row = await tx.targetOutcome.update({ where: { id }, data });
      return ok({
        result: { id: row.id },
        audit: {
          action: "target_outcome.updated",
          resourceType: "target_outcome",
          resourceId: row.id,
        },
      });
    }

    const row = await tx.targetOutcome.create({
      data: { ...data, tenantId: mctx.tenantId, createdBy: mctx.actorId },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "target_outcome.created",
        resourceType: "target_outcome",
        resourceId: row.id,
      },
    });
  });
}

export async function deleteTargetOutcome(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const found = await findOr404(tx.targetOutcome, {
      id,
      tenantId: mctx.tenantId,
      resourceType: "TargetOutcome",
    });
    if (isErr(found)) return found;

    await tx.targetOutcome.delete({ where: { id } });
    return ok({
      result: undefined,
      audit: { action: "target_outcome.deleted", resourceType: "target_outcome", resourceId: id },
    });
  });
}
