/**
 * Die Periode einer Run-the-Business-Position: über welchen Zeitraum ist der
 * gepflegte Betrag gemeint?
 *
 * Bis hierher war das ungeklärt und genau deshalb eine Falle. Der Betrag ging
 * **1:1** als Ask in eine Budget-Kachel (und eine Kachel ist ein Halbjahr,
 * `cycleKey` = `YYYY-H1|H2`), während die Solution-Kachel ihre Zahl mit „p. a."
 * beschriftete. Zwei Flächen, dieselbe Zahl, zwei Bedeutungen.
 *
 * Jetzt trägt jede Position ihre Periode selbst, und dieses Modul ist die
 * **einzige** Stelle, die die Faktoren kennt:
 *
 *   - `rtbAnnualAmount` — Jahres-Äquivalent, für die Run-Anzeige an Solution
 *     und Wertstrom.
 *   - `rtbCycleAmount` — Ask **einer** Halbjahres-Kachel, für die
 *     PB-Listen-Materialisierung.
 *
 * Default `half_yearly`: genau das bedeuten die Bestandszeilen: ihr Betrag war
 * der Ask einer Kachel. So bleibt jeder existierende Ask bitgenau gleich.
 */

export const RTB_INTERVALS = ["monthly", "half_yearly", "yearly"] as const;
export type RtbInterval = (typeof RTB_INTERVALS)[number];

export function isRtbInterval(s: string | null | undefined): s is RtbInterval {
  return s != null && (RTB_INTERVALS as readonly string[]).includes(s);
}

/** Effektive Periode: gültiger gespeicherter Wert, sonst `half_yearly`. */
export function rtbIntervalOrDefault(s: string | null | undefined): RtbInterval {
  return isRtbInterval(s) ? s : "half_yearly";
}

export const RTB_INTERVAL_KEYS: Record<RtbInterval, string> = {
  monthly: "budgeting.rtbInterval.monthly",
  half_yearly: "budgeting.rtbInterval.yearly",
  yearly: "budgeting.rtbInterval.yearly",
};

/** Wie oft die Periode in ein Jahr passt. */
const PER_YEAR: Record<RtbInterval, number> = {
  monthly: 12,
  half_yearly: 2,
  yearly: 1,
};

/** Jahres-Äquivalent des Betrags. */
export function rtbAnnualAmount(amount: number, interval: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  return amount * PER_YEAR[rtbIntervalOrDefault(interval)];
}

/**
 * Der Ask **einer** Budget-Kachel. Eine Kachel deckt ein Halbjahr ab, also das
 * halbe Jahres-Äquivalent — für `half_yearly` ist das wieder genau der
 * gepflegte Betrag.
 */
export function rtbCycleAmount(amount: number, interval: string | null | undefined): number {
  return rtbAnnualAmount(amount, interval) / 2;
}

/** Eine Position, so weit die Summen sie kennen müssen. */
export interface RtbAmountLike {
  plannedAmount: number;
  interval: string | null;
  active: boolean;
}

/** Σ Jahres-Äquivalent der **aktiven** Positionen. */
export function sumRtbAnnual(items: readonly RtbAmountLike[]): number {
  return items.reduce(
    (s, i) => (i.active ? s + rtbAnnualAmount(i.plannedAmount, i.interval) : s),
    0,
  );
}

/** Σ Kachel-Ask der **aktiven** Positionen. */
export function sumRtbCycle(items: readonly RtbAmountLike[]): number {
  return sumRtbAnnual(items) / 2;
}

/** Eine Position, so weit die Buendelung je Wertstrom sie kennen muss. */
export interface RtbGroupable extends RtbAmountLike {
  valueStreamId: string;
}

/**
 * **Der Kachel-Ask je Wertstrom** — die Grundlage der PB-Listen-Zeilen.
 *
 * Ein Wertstrom beantragt sein Run-the-Business-Budget als **eine** Summe;
 * welche Positionen dahinterstehen, entscheidet er selbst. Nur **aktive**
 * zaehlen, und ein Wertstrom ohne aktive Position taucht **gar nicht** auf:
 * ein Antrag ueber nichts ist kein fehlender Antrag, sondern keiner.
 *
 * **Warum hier und nicht zweimal daneben.** Dieselbe Rechnung stand in
 * `loadRtbPreview` (Entwurfs-Vorschau) und in `materializeRtbCandidates`
 * (Einfrieren beim Start). Der Docblock der ersten warnte selbst davor, dass
 * beide gleich rechnen muessen — „sonst zeigte der Entwurf n Zeilen und die
 * laufende Runde eine, und die Liste spraenge genau in dem Moment, in dem
 * niemand mehr etwas aendern kann". Die Kachel-Galerie waere die dritte
 * Abschrift geworden. Jetzt ist es eine.
 */
export function rtbAskByValueStream(items: readonly RtbGroupable[]): Map<string, number> {
  const byStream = new Map<string, number>();
  for (const i of items) {
    if (!i.active) continue;
    const cycle = rtbCycleAmount(i.plannedAmount, i.interval);
    byStream.set(i.valueStreamId, (byStream.get(i.valueStreamId) ?? 0) + cycle);
  }
  return byStream;
}
