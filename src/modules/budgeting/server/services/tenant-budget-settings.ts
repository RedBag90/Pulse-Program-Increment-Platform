/**
 * Die **zwei Mandanten-Felder**, die das Budgeting liest — in *einer* Abfrage,
 * einmal je Anfrage.
 *
 * Die ART-Budgetseite las die `Tenant`-Zeile bisher **zweimal**: einmal für
 * `guardrailTargets` (die Portfolio-Schwelle) und einmal, eine Ebene tiefer in
 * `art-coverage.ts`, für `costPerJobSizePoint`. Zwei Rundreisen für dieselbe
 * Zeile — und bei ~60 ms nach `eu-west-1` ist eine Rundreise kein Rundungsfehler
 * (Spec `art-budget-consolidation.md` §1.6).
 *
 * `cache()` sitzt hier und nicht bei den Aufrufern, weil beide dieselbe Frage
 * mit demselben Argument stellen — dasselbe Muster wie
 * `getValueStreamBudgets` (`budgeting.ts:213`).
 */

import { cache } from "react";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";

export interface TenantBudgetSettings {
  /** Guardrail-Ziele des Mandanten (JSON) — der Rückfall je Wertstrom. */
  guardrailTargets: unknown;
  /** Tenant-weiter €-Satz je Job-Size-Punkt; Rückfall, wenn die Historie schweigt. */
  costPerJobSizePoint: number | null;
}

export const getTenantBudgetSettings = cache(async function getTenantBudgetSettings(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<TenantBudgetSettings> {
  const row = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { guardrailTargets: true, costPerJobSizePoint: true },
  });
  return {
    guardrailTargets: row?.guardrailTargets ?? null,
    costPerJobSizePoint: row?.costPerJobSizePoint != null ? Number(row.costPerJobSizePoint) : null,
  };
});
