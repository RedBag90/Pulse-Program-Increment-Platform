/**
 * Was unter einem Halbjahr (`cycleKey`) an Geld liegt — rein, damit Server und
 * Löschdialog dieselbe Gestalt teilen. Lesen und Abräumen stehen in
 * `server/services/cycle-money.ts`.
 */
export interface CycleMoney {
  /** Zuspruch an ART-Töpfe (`art_change`). */
  artFrame: number;
  /** Run-Zuspruch (Betriebskosten). */
  run: number;
  /** Was ARTs aus ihrem Topf an Epics und eigene Arbeit weitergegeben haben. */
  artDistributed: number;
  /** Epic-Budgets dieses Halbjahres (`budget_allocations`). */
  epicBudgets: number;
}

export const NO_CYCLE_MONEY: CycleMoney = {
  artFrame: 0,
  run: 0,
  artDistributed: 0,
  epicBudgets: 0,
};

/**
 * Summe dessen, was ein Löschen zurücksetzt — `0` heisst: nichts. Die
 * ART-Verteilung zählt nicht extra; sie ist ein Teil des ART-Topfs.
 */
export function cycleMoneyTotal(m: CycleMoney): number {
  return m.artFrame + m.run + m.epicBudgets;
}
