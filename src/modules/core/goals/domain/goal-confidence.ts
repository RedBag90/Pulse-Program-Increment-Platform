/**
 * **Confidence Vote** — die SAFe-Faust-zu-Fünf als Fortschrittsquelle.
 *
 * Fünf Stufen, keine Zwischenwerte: die Hand zeigt eine Zahl, oder sie zeigt
 * keine. Genau deshalb steht die Skala hier und nicht als frei gesetztes
 * `baseline`/`target` am Ziel — wer eine Zuversicht misst, soll sich nicht erst
 * eine Skala ausdenken müssen.
 *
 * **Warum das eine Fortschrittsquelle sein darf.** Die drei vorhandenen Quellen
 * beantworten „woher kommt der Ist-Wert?"; die Zuversicht beantwortet „wie
 * sicher sind wir?". Das sind zwei Fragen, und sie sind nicht dasselbe: ein
 * Ziel kann zu 80 % erledigt sein und trotzdem wackeln. Für Ziele **ohne
 * Metrik** gibt es die erste Frage aber gar nicht — dort stand bis hierher ein
 * von Hand gesetzter Prozentwert, also eine erfundene Zahl. Eine
 * Fünfer-Zuversicht ist ehrlicher als die.
 *
 * Gerechnet wird nichts Neues: das Ziel trägt `baseline = 1`, `target = 5`, und
 * `keyResultProgress` macht daraus den gewohnten 0..1-Fortschritt (eine 3 ⇒
 * 0,5). Rollup, Zeitreihe und Check-in-Historie tragen unverändert.
 *
 * Rein, kein I/O.
 */

/** Die Enden der Faust-zu-Fünf. Sie sind zugleich `baseline` und `target`. */
export const CONFIDENCE_MIN = 1;
export const CONFIDENCE_MAX = 5;

export const CONFIDENCE_VALUES = [1, 2, 3, 4, 5] as const;
export type ConfidenceValue = (typeof CONFIDENCE_VALUES)[number];

export function isConfidenceValue(v: number): v is ConfidenceValue {
  return Number.isInteger(v) && v >= CONFIDENCE_MIN && v <= CONFIDENCE_MAX;
}

/**
 * Was die Finger bedeuten. Die Formulierungen sind bewusst Ich-Aussagen: eine
 * Faust-zu-Fünf ist eine persönliche Einschätzung, keine Bewertung des Ziels.
 */
export const CONFIDENCE_KEYS: Record<ConfidenceValue, string> = {
  1: "goals.confidence.1",
  2: "goals.confidence.2",
  3: "goals.confidence.3",
  4: "goals.confidence.4",
  5: "goals.confidence.5",
};

/**
 * **Die SAFe-Schwelle: unter 3 wird nachgeplant.**
 *
 * Bewusst `< 3` und nicht `<= 3`: eine glatte 3 heißt „könnte klappen" und ist
 * die unterste Stufe, mit der eine Zusage noch steht. Erst darunter ist die
 * Zusage keine mehr.
 */
export function needsReplan(value: number): boolean {
  return value < 3;
}

/** Die Felder, die `confidence` am Ziel festschreibt. */
export const CONFIDENCE_SCALE = {
  baseline: CONFIDENCE_MIN,
  target: CONFIDENCE_MAX,
  precision: 0,
  metricName: "Zuversicht",
} as const;

export interface ConfidenceScaleFields {
  baseline: number | null;
  target: number | null;
  precision: number;
  metricName: string | null;
}

/**
 * **Was die Skala beim Speichern mit dem Ziel macht** — in beide Richtungen.
 *
 * Wird `confidence` gewählt, schreibt sie sich auf die Zeile: `baseline = 1`,
 * `target = 5`. Danach *ist* das Ziel ein manuelles mit fester Skala, und die
 * gesamte vorhandene Rechnung greift ohne Sonderfall.
 *
 * **Und zurück.** Verlässt ein Ziel `confidence`, werden `baseline`/`target`
 * wieder freigegeben. Sie stehen zu lassen wäre die unangenehmere Variante: das
 * Ziel erbte stillschweigend eine Skala von 1 bis 5, die niemand gesetzt hat,
 * und der nächste Leser hielte sie für eine Entscheidung.
 *
 * `null` = an der Skala ist nichts zu tun.
 */
export function confidenceScaleFields(
  nextMode: string | null | undefined,
  prevMode: string | null | undefined,
): ConfidenceScaleFields | null {
  if (nextMode === "confidence") return { ...CONFIDENCE_SCALE };
  if (prevMode === "confidence") {
    return { baseline: null, target: null, precision: 0, metricName: null };
  }
  return null;
}
