/**
 * Budget-Zyklus fortschreiben (Rolling Window). Bewusst **eigene** Datei — nicht
 * in `budgeting.ts` —, weil das Fortschreiben `captureBudgetPlanRevision` ruft,
 * das seinerseits `getBudgetingBoard` aus `budgeting.ts` liest; ein Import hier
 * statt dort bricht den Zyklus.
 */

import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, isErr, type Result } from "@/modules/core/kernel/domain/errors";
import { parseHalfYearKey } from "@/modules/core/kernel/domain/calendar";
import {
  resolveActiveCycle,
  nextCycle,
  MIN_WINDOW_SIZE,
  MAX_WINDOW_SIZE,
} from "@/modules/budgeting/domain/budget-cycle";
import { captureBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";

/**
 * Schreibt die Zeitleiste fort: friert den ablaufenden Zyklus als
 * `BudgetPlanRevision` ein (keyed auf den Anker) und setzt den Anker ein Halbjahr
 * weiter. Nicht-destruktiv — nur ein Snapshot (idempotent) + ein Zeiger.
 */
export async function advanceBudgetCycle(
  ctx: RequestContext,
): Promise<Result<{ from: string; to: string }>> {
  const mctx = toMutationContext(ctx);

  const tenant = await ctx.db.tenant.findUnique({
    where: { id: mctx.tenantId },
    select: { activeBudgetCycle: true },
  });
  const from = resolveActiveCycle(
    { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
    new Date(),
  );

  // 1) Ablaufenden Zyklus einfrieren (Snapshot keyed auf den Anker, nicht `now`).
  const anchorStart = parseHalfYearKey(from);
  const snap = await captureBudgetPlanRevision(ctx, anchorStart ? { now: anchorStart } : {});
  if (isErr(snap)) return snap;

  // 2) Anker +1 Halbjahr.
  const to = nextCycle(from);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.tenant.update({ where: { id: mctx.tenantId }, data: { activeBudgetCycle: to } });
    return ok({
      result: { from, to },
      audit: {
        action: "budget.cycle.advanced" as const,
        resourceType: "tenant" as const,
        resourceId: mctx.tenantId,
        changes: { activeBudgetCycle: { before: from, after: to } },
      },
    });
  });
}

/** Setzt die Rolling-Window-Größe (Halbjahre), geklemmt auf [MIN, MAX]. */
export async function setBudgetWindowSize(
  ctx: RequestContext,
  input: { size: number },
): Promise<Result<{ size: number }>> {
  const mctx = toMutationContext(ctx);
  const size = Math.min(MAX_WINDOW_SIZE, Math.max(MIN_WINDOW_SIZE, Math.trunc(input.size)));
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.tenant.update({ where: { id: mctx.tenantId }, data: { budgetWindowSize: size } });
    return ok({
      result: { size },
      audit: {
        action: "budget.window.sized" as const,
        resourceType: "tenant" as const,
        resourceId: mctx.tenantId,
      },
    });
  });
}
