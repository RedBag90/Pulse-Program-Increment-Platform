import {
  appliedPeriod,
  periodValidity,
  type PeriodFacts,
} from "@/modules/budgeting/domain/period-validity";

/**
 * **Habe ich Budget — und für wann?**
 *
 * Die Frage des Epic Owners, und bis September 2026 auf der Epic-Detailseite
 * nicht zu beantworten: das Modell trug die Zuteilungen zwar (`allocatedByPeriod`),
 * gelesen wurden sie aber nur tief im Business-Case-Rechner.
 *
 * Die Antwort hat zwei Teile, und sie fallen auseinander:
 *
 *  - **Was gilt jetzt** — der Betrag im angewandten Budget-Rahmen. Das ist die
 *    Grenze, gegen die gerade ausgegeben werden darf.
 *  - **Was insgesamt vorgesehen ist** — die Summe über alle Zyklen und die
 *    Spanne vom ersten bis zum letzten.
 *
 * Ohne die Geltung aus `period-validity.ts` gäbe es diese Unterscheidung nicht;
 * dann hiesse jede Zuteilung gleichermassen „Budget erhalten", auch eine aus
 * einem längst abgelaufenen Rahmen.
 *
 * Rein, kein I/O; `now` wird injiziert.
 */

/** Eine Kachel, so weit dieser Fold sie kennen muss. */
export interface StandingRound extends PeriodFacts {
  cycleKey: string;
}

export const EPIC_BUDGET_STATES = ["applies", "upcoming", "expired", "none"] as const;
export type EpicBudgetState = (typeof EPIC_BUDGET_STATES)[number];

export interface EpicBudgetStanding {
  /**
   * `applies`  — Geld liegt im **angewandten** Rahmen: es darf ausgegeben werden.
   * `upcoming` — Geld liegt nur in Rahmen, die (noch) nicht gelten.
   * `expired`  — Geld liegt nur in abgelaufenen Rahmen.
   * `none`     — nirgends Geld.
   */
  state: EpicBudgetState;
  /** Betrag im angewandten Rahmen; 0, wenn keiner gilt oder dort nichts liegt. */
  currentAmount: number;
  /** Der angewandte Rahmen — `null`, wenn gerade keiner gilt. */
  currentPeriod: { cycleKey: string; start: Date | null; end: Date | null } | null;
  /** Summe über **alle** Zyklen mit Geld. */
  totalAmount: number;
  /** Wie viele Zyklen etwas tragen. */
  cycleCount: number;
  /** Erster Start bis letztes Ende der tragenden Zyklen; `null` ohne Kacheln. */
  span: { start: Date; end: Date } | null;
  /**
   * Bei `upcoming`: ab wann der früheste noch nicht geltende Rahmen beginnt.
   * `null`, wenn sein Zeitraum bereits läuft und nur die Ausarbeitung fehlt.
   */
  startsAt: Date | null;
}

const EMPTY: EpicBudgetStanding = {
  state: "none",
  currentAmount: 0,
  currentPeriod: null,
  totalAmount: 0,
  cycleCount: 0,
  span: null,
  startsAt: null,
};

export function epicBudgetStanding(input: {
  /** Halbjahr → €, bereits nach `chooseAllocation` entschieden. */
  byCycle: Readonly<Record<string, number>>;
  rounds: readonly StandingRound[];
  now: Date;
}): EpicBudgetStanding {
  const { byCycle, rounds, now } = input;

  const funded = Object.entries(byCycle).filter(([, amount]) => amount !== 0);
  if (funded.length === 0) return EMPTY;

  const totalAmount = funded.reduce((sum, [, amount]) => sum + amount, 0);
  const byKey = new Map(rounds.map((r) => [r.cycleKey, r]));

  // Die Spanne: erster Start bis letztes Ende der tragenden Zyklen. Zyklen ohne
  // Kachel (Alt-Daten) zählen in die Summe, aber nicht in die Spanne — lieber
  // keine Spanne als eine erfundene.
  const dated = funded
    .map(([cycleKey]) => byKey.get(cycleKey))
    .filter((r): r is StandingRound => r != null && r.startDate != null && r.endDate != null);
  const span =
    dated.length > 0
      ? {
          start: new Date(Math.min(...dated.map((r) => r.startDate!.getTime()))),
          end: new Date(Math.max(...dated.map((r) => r.endDate!.getTime()))),
        }
      : null;

  const applied = appliedPeriod(rounds, now);
  const appliedRound = applied ? rounds.find((r) => r.id === applied.period.id) : undefined;
  const currentAmount = appliedRound ? (byCycle[appliedRound.cycleKey] ?? 0) : 0;
  const currentPeriod = appliedRound
    ? { cycleKey: appliedRound.cycleKey, start: appliedRound.startDate, end: appliedRound.endDate }
    : null;

  if (currentAmount !== 0) {
    return {
      state: "applies",
      currentAmount,
      currentPeriod,
      totalAmount,
      cycleCount: funded.length,
      span,
      startsAt: null,
    };
  }

  // Kein Geld im geltenden Rahmen: liegt welches in einem Rahmen, der noch
  // kommt oder noch ausgearbeitet wird? Dann ist es zugesagt, gilt aber nicht.
  const pending = dated.filter((r) => periodValidity(r, now) === "in_preparation");
  const state: EpicBudgetState = pending.length > 0 ? "upcoming" : "expired";
  const future = pending.filter((r) => r.startDate!.getTime() > now.getTime());
  const startsAt =
    future.length > 0 ? new Date(Math.min(...future.map((r) => r.startDate!.getTime()))) : null;

  return {
    state,
    currentAmount: 0,
    currentPeriod,
    totalAmount,
    cycleCount: funded.length,
    span,
    startsAt,
  };
}
