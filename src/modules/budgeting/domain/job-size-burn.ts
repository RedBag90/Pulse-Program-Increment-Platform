import { addHalfYears, parseHalfYearKey } from "@/modules/core/kernel/domain/calendar";

/**
 * **Wie viel Lieferung das Geld kaufen sollte — und wo wir heute stehen.**
 *
 * Plan: das zugeteilte Budget des Halbjahrs, geteilt durch den €-Satz je
 * Job-Size-Punkt (`deriveJobSizeRate`), ergibt die **erwartete Job Size** bei
 * verbrauchtem Budget. Sie wächst linear über das Halbjahr — Geld fliesst
 * ungefähr gleichmässig, und eine genauere Kurve hätten wir nicht.
 *
 * Ist: Σ Job Size der **fertig gemeldeten** Features, datiert wie beim Satz
 * (`completedAt`, ersatzweise das PI-Ende), in der Kachel und bis heute. Eine
 * Stufe je Abschlusstag.
 *
 * Das **Band** von ±20 % sagt, dass beides Schätzungen sind: der Satz kommt
 * aus zwei vergangenen Halbjahren, die Job Size aus einer Einschätzung. Eine
 * Abweichung innerhalb des Bands ist Rauschen, keine Aussage.
 *
 * Rein — keine Datenbank, keine Uhr (`today` kommt herein).
 */

export const BURN_BAND = 0.2;

export interface Completion {
  at: Date;
  jobSize: number;
}

export interface BurnPoint {
  at: Date;
  cumulative: number;
}

/**
 * Warum es (k)einen Plan gibt: `noRate` — kein €-Satz; `noBudget` — ein Satz,
 * aber nichts zugeteilt. Eine Plan-Linie auf null wäre keine Aussage, sondern
 * sähe aus wie ein Fehler.
 */
export type BurnReason = "ok" | "noRate" | "noBudget";

/**
 * **Das Fenster des Verlaufs: die geltende Budget-Kachel** (Budget-Stichtag;
 * `AppliedTile` erfüllt diese Form). Budget wird je
 * Kachel zugeteilt, nicht je Kalender-Halbjahr, und eine Kachel hat eigene
 * Daten (im Bestand etwa 06.01.–03.07., mit Lücken dazwischen).
 */
export interface BurnWindow {
  /** Schlüssel des Geldes der Kachel (`BudgetRound.cycleKey`). */
  cycleKey: string;
  /** Erster Tag. */
  start: Date;
  /** Erster Tag **nach** der Kachel — die Grenze, nicht der letzte Tag. */
  end: Date;
  /** `true` = die Kachel ist vorbei und gilt in einer Lücke fort. */
  extended: boolean;
}

/** Ein Kalender-Halbjahr als Fenster — für Tests und als Rückfall. */
export function halfYearWindow(cycleKey: string): BurnWindow {
  const start = parseHalfYearKey(cycleKey);
  if (!start) throw new Error(`Ungültiges Halbjahr: ${cycleKey}`);
  return { cycleKey, start, end: addHalfYears(start, 1), extended: false };
}

export interface JobSizeBurn {
  cycleKey: string;
  reason: BurnReason;
  start: Date;
  /** Erster Tag nach dem Fenster — die Grenze, nicht der letzte Tag. */
  end: Date;
  /** Die Kachel ist vorbei und gilt fort (Lücke bis zur nächsten). */
  extended: boolean;
  today: Date;
  /** Budget ÷ Satz; `null` ohne Satz (dann gibt es keinen Plan). */
  expected: number | null;
  /** Der Plan am heutigen Tag, linear; `null` ohne Satz. */
  planToday: number | null;
  actualToday: number;
  /** (Ist − Plan heute) ÷ Plan heute; `null` ohne Plan oder vor dem Start. */
  deviation: number | null;
  /** Innerhalb ±`BURN_BAND` um den Plan heute; `null`, wenn es nichts zu vergleichen gibt. */
  withinBand: boolean | null;
  /** Die Ist-Stufen: beginnt bei (start, 0), endet bei (min(heute, Ende), Ist). */
  actual: BurnPoint[];
}

/** Anteil des Fensters, der bis `at` vergangen ist — geklemmt auf 0…1. */
function elapsed(start: Date, end: Date, at: Date): number {
  const f = (at.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.min(1, Math.max(0, f));
}

export function jobSizeBurn(input: {
  window: BurnWindow;
  allocated: number;
  /** €/Punkt; `null` ohne Satz. */
  rate: number | null;
  completions: readonly Completion[];
  today: Date;
}): JobSizeBurn {
  const { start, end } = input.window;
  const { today } = input;
  const bis = today < end ? today : end;

  const imFenster = input.completions
    .filter((c) => c.at >= start && c.at < end && c.at <= today && c.jobSize > 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const actual: BurnPoint[] = [{ at: start, cumulative: 0 }];
  let summe = 0;
  for (const c of imFenster) {
    summe += c.jobSize;
    const letzte = actual[actual.length - 1]!;
    // Mehrere Abschlüsse am selben Zeitpunkt: eine Stufe, nicht mehrere.
    if (letzte.at.getTime() === c.at.getTime()) letzte.cumulative = summe;
    else actual.push({ at: c.at, cumulative: summe });
  }
  if (today > start) actual.push({ at: bis, cumulative: summe });

  const reason: BurnReason =
    input.rate == null || input.rate <= 0 ? "noRate" : input.allocated <= 0 ? "noBudget" : "ok";
  const expected = reason === "ok" ? input.allocated / input.rate! : null;
  const planToday = expected == null ? null : expected * elapsed(start, end, today);
  const deviation = planToday == null || planToday <= 0 ? null : (summe - planToday) / planToday;

  return {
    cycleKey: input.window.cycleKey,
    reason,
    start,
    end,
    extended: input.window.extended,
    today,
    expected,
    planToday,
    actualToday: summe,
    deviation,
    withinBand: deviation == null ? null : Math.abs(deviation) <= BURN_BAND,
    actual,
  };
}

/**
 * **Der Wertstrom-Verlauf** — Σ der ART-Verläufe **mit** Satz.
 *
 * Es gibt keinen Wertstrom-Satz (`budget-kpis.ts`): jedes ART rechnet seine
 * erwartete Job Size mit seinem eigenen Satz, der Wertstrom summiert sie. Das
 * Ist nimmt dieselben ARTs — sonst stünde Lieferung ohne Plan gegen einen Plan
 * ohne diese Lieferung.
 */
export function streamBurn(
  window: BurnWindow,
  today: Date,
  arts: readonly { burn: JobSizeBurn; completions: readonly Completion[] }[],
): JobSizeBurn {
  // Nur ARTs mit Plan (Satz **und** Budget) tragen Plan und Ist.
  const mitPlan = arts.filter((a) => a.burn.reason === "ok");
  if (mitPlan.length > 0) {
    return jobSizeBurn({
      window,
      // Rate 1 und Budget = Σ erwartet: dieselbe Mathematik, ohne einen
      // erfundenen Wertstrom-Satz nach aussen zu tragen.
      allocated: mitPlan.reduce((s, a) => s + (a.burn.expected ?? 0), 0),
      rate: 1,
      completions: mitPlan.flatMap((a) => a.completions),
      today,
    });
  }
  // Kein ART mit Plan: der Grund des Wertstroms ist „kein Budget", sobald
  // eines einen Satz hat, sonst „kein Satz". Das Ist zeigt, was geliefert
  // wurde — ohne Plan gibt es nichts, womit es sich vermischen könnte.
  const mitSatz = arts.some((a) => a.burn.reason === "noBudget");
  return jobSizeBurn({
    window,
    allocated: 0,
    rate: mitSatz ? 1 : null,
    completions: arts.flatMap((a) => a.completions),
    today,
  });
}
