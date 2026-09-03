/**
 * Der **Verlauf** einer Halbjahres-Zuteilung über ihre Monate.
 *
 * Eine Halbjahres-Zuteilung, gleichmäßig auf ihre sechs Monate verteilt, ergibt
 * jeden Monat denselben Betrag — die Säulenhöhe ist deshalb **konstant**. Was
 * wandert, ist allein die Zusammensetzung: von „nicht begonnen" über „gebunden"
 * nach „verbraucht". Genau das ist die Aussage des Charts; ein schwankender
 * Stapel würde eine Bewegung suggerieren, die es nicht gibt.
 *
 * Der zeitabhängige Teil — in welchem Reifegrad ein Epic in einem gegebenen
 * Monat stand — wird **hereingereicht**, nicht hier gerechnet: er stammt aus
 * Work (`stageAtMonth`), und diese Faltung soll ohne Work testbar bleiben.
 *
 * Rein, kein I/O.
 */

import type { AllocationState } from "@/modules/budgeting/domain/allocation-state";

export interface CourseMonth {
  key: string;
  label: string;
}

export interface CourseEpic {
  /** Zuteilung im Halbjahr — wird gleichmäßig auf die Monate verteilt. */
  amount: number;
  /** Zustand je Monat, gleiche Länge und Reihenfolge wie die Monatsachse. */
  states: readonly AllocationState[];
}

export interface CoursePoint extends CourseMonth {
  byState: Record<AllocationState, number>;
  /** Σ des Monats — innerhalb eines Halbjahres für alle Monate gleich. */
  total: number;
}

export interface AllocationCourse {
  points: CoursePoint[];
  /** Der konstante Monatsbetrag: Σ Zuteilung ÷ Monate. */
  perMonth: number;
  /**
   * Was bis einschließlich `todayIndex` in Arbeit oder geliefert sein müsste,
   * wenn die Zuteilung gleichmäßig abfließt — die Bezugsgröße, gegen die der
   * Stapel gelesen wird. `null`, wenn „heute" außerhalb des Fensters liegt.
   */
  expectedByToday: number | null;
  /** Was bis dahin tatsächlich gebunden oder verbraucht ist. */
  actualByToday: number | null;
}

const zero = (): Record<AllocationState, number> => ({
  notStarted: 0,
  committed: 0,
  consumed: 0,
});

/**
 * Faltet Zuteilungen und Zustands-Reihen in den Monatsverlauf.
 *
 * Epics, deren Zustands-Reihe nicht zur Achse passt, fallen heraus statt still
 * falsch gezeichnet zu werden — eine Länge, die nicht stimmt, ist ein Fehler
 * beim Aufrufer, kein Datenrauschen.
 */
export function buildAllocationCourse(
  months: readonly CourseMonth[],
  epics: readonly CourseEpic[],
  todayIndex = -1,
): AllocationCourse {
  const n = months.length;
  if (n === 0) return { points: [], perMonth: 0, expectedByToday: null, actualByToday: null };

  const usable = epics.filter((e) => e.amount !== 0 && e.states.length === n);
  const points: CoursePoint[] = months.map((m) => ({ ...m, byState: zero(), total: 0 }));

  for (const e of usable) {
    const share = e.amount / n;
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      p.byState[e.states[i]!] += share;
      p.total += share;
    }
  }

  const perMonth = usable.reduce((s, e) => s + e.amount, 0) / n;
  const inWindow = todayIndex >= 0 && todayIndex < n;
  const point = inWindow ? points[todayIndex]! : null;

  return {
    points,
    perMonth,
    // Gleichmäßiger Abfluss: nach m von n Monaten sollten m/n des Halbjahres
    // nicht mehr unangetastet sein.
    expectedByToday: inWindow ? perMonth * ((todayIndex + 1) / n) : null,
    actualByToday: point ? point.byState.committed + point.byState.consumed : null,
  };
}
