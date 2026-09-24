/**
 * **Gilt dieses Budget gerade?** — die Frage, die es bisher nicht gab.
 *
 * `BudgetRound.status` (`draft → running → decided → closed`) beschreibt die
 * **Vorbereitung**: es ist die Maschine der sieben Phasen, und `roundEditability`
 * bestätigt das — jeder Status öffnet einen Teil der *Bearbeitung*. Keiner sagt
 * „dieses Budget gilt", keiner sagt „abgelaufen".
 *
 * Daraus folgte ein Fehler mit Wirkung bis in die Portfolio-Übersicht:
 * `activeCycleFromRounds` liefert die Kachel mit `status === "running"`, also die
 * in **Phase 5, Verteilen**. In Large Test Corp war das eine Kachel, deren
 * Zeitraum erst vier Monate später beginnt und die kein Geld trägt — während die
 * Kachel, die den heutigen Tag abdeckt, 1,00 Mio € führt.
 *
 * Die Geltung wird deshalb **abgeleitet**, nicht gespeichert: kein zweites Feld,
 * kein Cron, kein Statuswechsel-Job. Wie `frozen` in `domain/epic-horizon.ts`.
 *
 * Rein, kein I/O; `now` wird injiziert.
 */

export const PERIOD_VALIDITIES = ["in_preparation", "applied", "expired"] as const;
export type PeriodValidity = (typeof PERIOD_VALIDITIES)[number];

export const PERIOD_VALIDITY_KEYS: Record<PeriodValidity, string> = {
  in_preparation: "budgeting.periodValidity.inPreparation",
  applied: "budgeting.periodValidity.applied",
  expired: "budgeting.periodValidity.expired",
};

/**
 * Der Prozess-Status, ab dem eine Kachel **vollständig definiert** ist.
 *
 * Das ist Schritt 6, „Finalisieren": dort steht die Verteilung fest und die
 * Zahlen ändern sich nicht mehr. Schritt 7, „Protokoll", friert davon eine
 * Fassung ein — Dokumentation, keine Definition.
 */
const FINALIZED = "closed";

/** Nur die Felder, die die Ableitung braucht — strukturell getippt. */
export interface PeriodFacts {
  id: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

const DAY = 86_400_000;

/**
 * Beide Enden sind **einschliessend**: der Starttag und der Endtag gehören dazu.
 * Die Spalten tragen Mitternacht (UTC), deshalb reicht der Endtag bis kurz vor
 * Mitternacht des Folgetags.
 */
function covers(p: PeriodFacts, now: Date): boolean {
  if (p.startDate == null || p.endDate == null) return false;
  const t = now.getTime();
  return t >= p.startDate.getTime() && t < p.endDate.getTime() + DAY;
}

const isFinalized = (p: PeriodFacts) => p.status === FINALIZED;

/** Die Geltung **einer** Kachel, für Beschriftung und Sortierung. */
export function periodValidity(p: PeriodFacts, now: Date): PeriodValidity {
  // Solange die Vorbereitung läuft, gilt nichts — auch nicht, wenn der Zeitraum
  // schon begonnen hat. Ein halbfertiger Rahmen setzt keine Grenzen.
  if (!isFinalized(p)) return "in_preparation";
  if (p.startDate == null || p.endDate == null) return "in_preparation";
  if (now.getTime() < p.startDate.getTime()) return "in_preparation";
  if (covers(p, now)) return "applied";
  return "expired";
}

export interface AppliedPeriod {
  period: PeriodFacts;
  /**
   * `true` = der Zeitraum dieser Kachel ist vorbei; sie gilt weiter, weil der
   * heutige Tag in **keine** Kachel fällt. Die Fläche macht das kenntlich.
   */
  extended: boolean;
  /** Weitere Kacheln, die denselben Tag abdecken — sollte leer sein. */
  overlapping: PeriodFacts[];
}

/**
 * **Welches Budget gilt heute?** Drei Lagen, bewusst getrennt:
 *
 *  1. Der heutige Tag liegt in einer **finalisierten** Kachel → sie gilt.
 *  2. Er liegt in **keiner** Kachel (Lücke) → die zuletzt abgelaufene
 *     finalisierte gilt weiter, `extended: true`. Gemessen klaffen zwischen je
 *     zwei Kacheln 3–10 Tage; ohne diese Regel verschwänden mehrmals im Jahr für
 *     ein paar Tage sämtliche Zahlen.
 *  3. Er liegt in einer Kachel, die **nicht** finalisiert ist → `null`. Das ist
 *     der unfertige Nachfolger, und für ihn gilt ausdrücklich kein Budget.
 *
 * Decken mehrere finalisierte Kacheln denselben Tag ab, gilt die mit dem
 * **späteren Start**; die übrigen stehen in `overlapping`, damit die Fläche die
 * Überschneidung melden kann, statt sie zu verschlucken.
 */
export function appliedPeriod(periods: readonly PeriodFacts[], now: Date): AppliedPeriod | null {
  const byLatestStart = (a: PeriodFacts, b: PeriodFacts) =>
    (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0) || b.id.localeCompare(a.id);

  const covering = periods.filter((p) => isFinalized(p) && covers(p, now)).sort(byLatestStart);
  if (covering.length > 0) {
    return { period: covering[0]!, extended: false, overlapping: covering.slice(1) };
  }

  // Liegt der Tag in einer unfertigen Kachel, gilt nichts — nicht die vorige.
  if (periods.some((p) => !isFinalized(p) && covers(p, now))) return null;

  // Lücke: die zuletzt abgelaufene finalisierte Kachel gilt weiter.
  const past = periods
    .filter(
      (p) => isFinalized(p) && p.endDate != null && p.endDate.getTime() + DAY <= now.getTime(),
    )
    .sort(
      (a, b) =>
        (b.endDate?.getTime() ?? 0) - (a.endDate?.getTime() ?? 0) || b.id.localeCompare(a.id),
    );
  return past.length > 0 ? { period: past[0]!, extended: true, overlapping: [] } : null;
}

/**
 * Darf der Zeitraum dieser Kachel noch bewegt werden?
 *
 * Den Start einer geltenden Kachel zu verschieben oder ihr Ende vorzuziehen
 * verschöbe **rückwirkend** die Grenze, gegen die schon Geld verplant wurde.
 * Verlängern bleibt offen — es nimmt niemandem etwas weg.
 */
export interface TimeframeEditability {
  start: boolean;
  /** `"free"` = beliebig, `"extend"` = nur nach hinten, `false` = gar nicht. */
  end: "free" | "extend" | false;
}

export function timeframeEditability(validity: PeriodValidity): TimeframeEditability {
  switch (validity) {
    case "in_preparation":
      return { start: true, end: "free" };
    case "applied":
      return { start: false, end: "extend" };
    case "expired":
      return { start: false, end: false };
  }
}

const NO_START =
  "Der Start einer geltenden Kachel liegt fest — er ist die Grenze, ab der Geld verplant wurde.";
const NO_SHORTEN =
  "Das Ende einer geltenden Kachel lässt sich nur verlängern. Es vorzuziehen entzöge bereits verplantem Geld nachträglich die Deckung.";
const EXPIRED = "Der Zeitraum ist abgelaufen und lässt sich nicht mehr ändern.";

/**
 * `null` = erlaubt. Sonst der Grund — wie `horizonEditDeniedReason` und
 * `rtbManageDeniedReason`: sagen, **warum** nicht, statt nur „nein".
 */
export function timeframeEditDeniedReason(input: {
  validity: PeriodValidity;
  current: { startDate: Date | null; endDate: Date | null };
  next: { startDate: Date; endDate: Date };
}): string | null {
  const rules = timeframeEditability(input.validity);
  if (rules.end === false) return EXPIRED;
  const startMoved = input.current.startDate?.getTime() !== input.next.startDate.getTime();
  if (startMoved && !rules.start) return NO_START;
  if (
    rules.end === "extend" &&
    input.current.endDate != null &&
    input.next.endDate.getTime() < input.current.endDate.getTime()
  ) {
    return NO_SHORTEN;
  }
  return null;
}
