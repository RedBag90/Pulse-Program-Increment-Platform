/**
 * Budget-Zyklus — der manuell fortgeschriebene Anker des Rolling-Window.
 *
 * Bis zur ersten Fortschreibung ist der Anker `null`; dann gilt das Halbjahr von
 * `now` (Verhalten wie vor dem Feature). Ist er gesetzt, ist er die **eine**
 * Quelle für „welches Halbjahr ist der aktive Zyklus" — statt der verstreuten
 * `halfYearKey(now)`-Aufrufe. Rein, kein I/O.
 */

import { halfYearKey, parseHalfYearKey, addHalfYears } from "@/modules/core/kernel/domain/calendar";

/** Nur die Felder, die der Resolver braucht — strukturell getippt. */
export interface BudgetCycleFields {
  activeBudgetCycle: string | null;
  budgetWindowSize: number | null;
}

/** Grenzen der Fenstergröße — mind. 2 Halbjahre (1 Jahr), max. 8 (4 Jahre). */
export const MIN_WINDOW_SIZE = 2;
export const MAX_WINDOW_SIZE = 8;
export const DEFAULT_WINDOW_SIZE = 4;

/** Der aktive Zyklus: der gespeicherte Anker, sonst das Halbjahr von `now`. */
export function resolveActiveCycle(tenant: Pick<BudgetCycleFields, "activeBudgetCycle">, now: Date): string {
  const anchor = tenant.activeBudgetCycle;
  return anchor && parseHalfYearKey(anchor) ? anchor : halfYearKey(now);
}

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
