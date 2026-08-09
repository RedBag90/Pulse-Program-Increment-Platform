import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/modules/core/kernel/server/mutation";

/**
 * Referential n:m Risk↔Epic link (hard FK to Initiative; no value rollup).
 * Mirrors `goal-related-work.ts`. Gate `risk.link` in the action.
 */
export async function linkRiskToEpic(
  ctx: RequestContext,
  input: { riskId: string; epicId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const risk = await tx.risk.findFirst({
        where: { id: input.riskId, tenantId: mctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!risk) return err({ kind: "not_found" as const, resourceType: "Risk", id: input.riskId });

      const epic = await tx.initiative.findFirst({
        where: {
          id: input.epicId,
          tenantId: mctx.tenantId,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!epic) {
        return err({ kind: "not_found" as const, resourceType: "Initiative", id: input.epicId });
      }

      const row = await tx.riskEpicLink.create({
        data: {
          tenantId: mctx.tenantId,
          riskId: input.riskId,
          epicId: input.epicId,
          createdBy: mctx.actorId,
        },
        select: { id: true },
      });
      return ok({
        result: { id: row.id },
        audit: {
          action: "risk.epic.linked" as const,
          resourceType: "risk_epic_link" as const,
          resourceId: row.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint("Risiko ist bereits mit diesem Epic verknüpft.") },
  );
}

export async function unlinkRiskFromEpic(
  ctx: RequestContext,
  input: { riskId: string; epicId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const { count } = await tx.riskEpicLink.deleteMany({
      where: { tenantId: mctx.tenantId, riskId: input.riskId, epicId: input.epicId },
    });
    if (count === 0) {
      return err({ kind: "not_found" as const, resourceType: "RiskEpicLink", id: input.epicId });
    }
    return ok({
      result: undefined,
      audit: {
        action: "risk.epic.unlinked" as const,
        resourceType: "risk_epic_link" as const,
        resourceId: input.riskId,
      },
    });
  });
}
