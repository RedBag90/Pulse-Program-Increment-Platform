import { cache } from "react";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  budgetStichtag,
  type BudgetStichtag,
  type StichtagPeriod,
} from "@/modules/budgeting/domain/budget-stichtag";

/**
 * Die Kacheln eines Mandanten — **eine** Abfrage je Request.
 *
 * Vorher lasen `loadRunningPeriod`, `getEpicCycleAllocations`,
 * `getEpicBudgetStanding` und `loadBudgetingModel` jede für sich dieselben
 * Spalten; der Portfolio Sync schickte drei davon in einem Render los.
 * Wie die Lader in `budget-reads.ts` nur `(db, tenantId)` als Argumente, damit
 * `cache()` dedupliziert.
 */
export const readBudgetPeriods = cache(
  async (db: Pick<PrismaClient, "budgetRound">, tenantId: TenantId): Promise<StichtagPeriod[]> =>
    db.budgetRound.findMany({
      where: { tenantId },
      select: { id: true, cycleKey: true, status: true, startDate: true, endDate: true },
    }),
);

/**
 * **Der Budget-Stichtag eines Mandanten** — welche Kachel gilt, worauf Flächen
 * ohne eigene Wahl stehen, was verteilt werden darf (`domain/budget-stichtag.ts`).
 */
export async function loadBudgetStichtag(
  db: Pick<PrismaClient, "budgetRound">,
  tenantId: TenantId,
  now: Date = new Date(),
): Promise<BudgetStichtag> {
  return budgetStichtag(await readBudgetPeriods(db, tenantId), now);
}
