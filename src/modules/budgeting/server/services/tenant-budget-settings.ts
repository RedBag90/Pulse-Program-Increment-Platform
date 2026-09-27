/**
 * Das Mandanten-Feld, das das Budgeting liest — die Guardrail-Ziele, einmal je
 * Anfrage. Bis September 2026 kam der €-Satz je Job-Size-Punkt
 * (`costPerJobSizePoint`) mit; der Rückfall-Satz ist entfallen, die Schätzung
 * je ART ersetzt ihn.
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
}

export const getTenantBudgetSettings = cache(async function getTenantBudgetSettings(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<TenantBudgetSettings> {
  const row = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { guardrailTargets: true },
  });
  return { guardrailTargets: row?.guardrailTargets ?? null };
});
