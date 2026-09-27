/**
 * Budget-Zyklus — wie weit das Rolling-Window reicht.
 *
 * Welches Halbjahr gilt, sagt der Budget-Stichtag (`budget-stichtag.ts`). Die
 * frühere Regel „die Kachel mit Status running" (`activeCycleFromRounds`) ist
 * im September 2026 entfallen. Rein, kein I/O.
 */

import { halfYearKey, parseHalfYearKey, addHalfYears } from "@/modules/core/kernel/domain/calendar";

/** Nur die Felder, die der Resolver braucht — strukturell getippt. */
export interface BudgetCycleFields {
  budgetWindowSize: number | null;
}

/** Grenzen der Fenstergröße — mind. 2 Halbjahre (1 Jahr), max. 8 (4 Jahre). */
export const MIN_WINDOW_SIZE = 2;
export const MAX_WINDOW_SIZE = 8;
export const DEFAULT_WINDOW_SIZE = 4;

/** Die Fenstergröße in Halbjahren, geklemmt auf [MIN, MAX], Default 4. */
export function resolveWindowSize(tenant: Pick<BudgetCycleFields, "budgetWindowSize">): number {
  const raw = tenant.budgetWindowSize ?? DEFAULT_WINDOW_SIZE;
  return Math.min(MAX_WINDOW_SIZE, Math.max(MIN_WINDOW_SIZE, Math.trunc(raw)));
}

/** Der nächste Zyklus (`+1` Halbjahr) — für das Fortschreiben. */
export function nextCycle(cycleKey: string): string {
  const start = parseHalfYearKey(cycleKey);
  if (!start) return cycleKey;
  return halfYearKey(addHalfYears(start, 1));
}
