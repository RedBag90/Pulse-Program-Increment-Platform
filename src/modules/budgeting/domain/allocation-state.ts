/**
 * Die **Zustandsstaffel** einer Zuteilung: nicht begonnen · gebunden · verbraucht.
 *
 * Warum es sie braucht: Das ART-Budget *ist* bereits die Summe der Zuteilungen
 * seiner Epics (`getArtBudgetBreakdown` gruppiert `BudgetCandidate.finalAmount`
 * nach `artId`). Zugeteilt und „verbraucht" wären damit dieselbe Zahl, und ein
 * Restbudget gäbe es strukturell nicht. Erst die Staffelung nach dem Zustand des
 * Epics macht aus einer Summe eine Aussage.
 *
 * Pulse kennt keine Ist-Kosten — kein Modell, keine Spalte hält je ausgegebenes
 * Geld. Der Verbrauch ist deshalb **abgeleitet**, und zwar aus Stempeln, die
 * ohnehin gesetzt und auditiert sind. Das Vokabular ist nicht neu erfunden:
 * `aggregateHorizonBudgets` unterscheidet im Portfolio-Kanban schon
 * „budgetiert / Umsetzung / umgesetzt".
 *
 * Rein, kein I/O.
 */

export const ALLOCATION_STATES = ["notStarted", "committed", "consumed"] as const;
export type AllocationState = (typeof ALLOCATION_STATES)[number];

/** Beschriftung der Fläche — „nicht begonnen" heißt ausdrücklich nicht „frei". */
export const ALLOCATION_STATE_LABELS: Record<AllocationState, string> = {
  notStarted: "Nicht begonnen",
  committed: "Gebunden",
  consumed: "Verbraucht",
};

/**
 * Die Reifegrad-Fakten, die die Staffel braucht — und zugleich die **Naht zu
 * Work**: Budgeting importiert Work nicht (ADR-0013), die Route reicht diese
 * Felder herein, wie es der `BudgetingDataPort` in der Gegenrichtung tut.
 */
export interface AllocatedEpic {
  epicId: string;
  /** Zuteilung im betrachteten Halbjahr. 0 heißt „keine Zuteilung". */
  amount: number;
  /** `Initiative.stageGate` — L0…L5, ohne Sub-Stufe. */
  stageGate: string;
  /** `Initiative.implementationCompletedAt` — der L4.2-Stempel. */
  implementationCompletedAt: Date | null;
}

/**
 * Der Zustand **einer** Zuteilung.
 *
 * `implementationCompletedAt` gewinnt vor dem Reifegrad: die Spalte bleibt auf
 * „L4" stehen, während der Stempel bereits L4.2 („Umsetzung fertig") bedeutet —
 * dieselbe Regel, die `currentGateStep` anwendet. Wer nur auf `stageGate`
 * schaut, zählt gelieferte Arbeit als laufend.
 */
export function allocationState(
  e: Pick<AllocatedEpic, "stageGate" | "implementationCompletedAt">,
): AllocationState {
  if (e.implementationCompletedAt != null || e.stageGate === "L5") return "consumed";
  if (e.stageGate === "L4") return "committed";
  return "notStarted";
}

export interface AllocationRow extends AllocatedEpic {
  state: AllocationState;
}

export interface AllocationBreakdown {
  /** Σ über alle Zuteilungen — die Zahl, die heute allein dasteht. */
  total: number;
  /** Σ je Zustand. Die drei summieren sich auf `total`. */
  byState: Record<AllocationState, number>;
  countByState: Record<AllocationState, number>;
  /** Die Zeilen, sortiert: was noch nicht läuft, steht oben. */
  rows: AllocationRow[];
}

/** Reihenfolge der Zustände in der Liste — das Unerledigte zuerst. */
const SORT_ORDER: Record<AllocationState, number> = { notStarted: 0, committed: 1, consumed: 2 };

const zero = (): Record<AllocationState, number> => ({ notStarted: 0, committed: 0, consumed: 0 });

/**
 * Faltet die Zuteilungen eines ARTs (oder Wertstroms) in die Staffel.
 *
 * Epics **ohne** Zuteilung fallen heraus, statt mit 0 zu erscheinen: die
 * Zyklus-Karte schreibt auch 0-Zellen, und eine Liste voller Nullzeilen sagt
 * nichts. Wer sie sehen will, sieht sie in der Epic-Liste, nicht in der
 * Budget-Staffel.
 */
export function summarizeAllocations(items: readonly AllocatedEpic[]): AllocationBreakdown {
  const rows: AllocationRow[] = [];
  const byState = zero();
  const countByState = zero();
  let total = 0;

  for (const e of items) {
    if (e.amount === 0) continue;
    const state = allocationState(e);
    rows.push({ ...e, state });
    byState[state] += e.amount;
    countByState[state] += 1;
    total += e.amount;
  }

  rows.sort((a, b) => SORT_ORDER[a.state] - SORT_ORDER[b.state] || b.amount - a.amount);
  return { total, byState, countByState, rows };
}

/**
 * Der Anteil eines Zustands am Ganzen, gerundet auf Prozent. `total === 0` → 0,
 * damit die Fläche keine Division durch null anzeigen muss.
 */
export function allocationShare(b: AllocationBreakdown, state: AllocationState): number {
  return b.total === 0 ? 0 : Math.round((b.byState[state] / b.total) * 100);
}
