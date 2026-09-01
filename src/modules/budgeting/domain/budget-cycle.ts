/**
 * Budget-Zyklus — welches Halbjahr gerade das laufende ist, und wie weit das
 * Rolling-Window reicht.
 *
 * Der aktive Zyklus ergibt sich aus den **Kacheln** (`activeCycleFromRounds`),
 * nicht mehr aus einem tenant-weiten Anker: es gibt keinen einzelnen aktiven
 * Zyklus, es gibt eine laufende Kachel. Rein, kein I/O.
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

export interface CycleRound {
  cycleKey: string;
  status: string;
  startDate: Date | null;
}

/**
 * Der Zyklus, an dem gearbeitet wird: die **laufende** Kachel, sonst die
 * jüngste, sonst das heutige Halbjahr.
 *
 * Ersetzt den tenant-weiten Anker `Tenant.activeBudgetCycle`. Der unterstellte
 * *einen* aktiven Zyklus, während das Kachel-Modell mehrere koexistieren lässt
 * — Kacheln werden über ihre `id` identifiziert, nicht über ihr Halbjahr.
 */
export function activeCycleFromRounds(rounds: readonly CycleRound[], now: Date): string {
  const running = rounds.find((r) => r.status === "running");
  if (running) return running.cycleKey;
  const newest = [...rounds].sort(
    (a, b) =>
      (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) ||
      b.cycleKey.localeCompare(a.cycleKey),
  )[0];
  return newest?.cycleKey ?? halfYearKey(now);
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
