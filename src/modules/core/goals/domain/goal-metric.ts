/**
 * Metrik-Typ eines Key Results — bestimmt Formatierung, Achsen und Eingabe.
 * Pendant zu Asanas `goal.metric.unit` (percentage | none | currency).
 *
 * Getrennt vom freien Label `KeyResult.metricUnit` (z. B. „Kunden"): dieses
 * Feld steuert das *Verhalten*, jenes nur den Text.
 */

/**
 * **Jeder Typ, der in Daten vorkommen kann** — einschliesslich abgelegter.
 *
 * Nicht dasselbe wie {@link SELECTABLE_METRIC_TYPES}, und der Unterschied ist
 * Absicht: `number` („Zahl") wird seit September 2026 **nicht mehr angeboten**,
 * aber der grösste Teil des Bestands steht darauf — er war bis dahin der
 * Vorgabewert der Spalte. Diese Liste bleibt darum vollständig, damit ein
 * solches Ziel lesbar, formatierbar und speicherbar bleibt.
 */
export const METRIC_TYPES = ["number", "percent", "currency", "individuell"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

/**
 * **Was das Formular anbietet.** „Zahl" steht hier nicht mehr: neue Ziele
 * entstehen nicht mehr darauf, bestehende tragen ihn weiter.
 *
 * Wer einen Typ abschafft, ändert diese Liste — nicht {@link METRIC_TYPES}.
 * Ein Wert aus der Auswahl zu nehmen ist eine Produktentscheidung; ihn aus dem
 * Vokabular zu nehmen wäre eine Aussage über fremde Daten.
 */
export const SELECTABLE_METRIC_TYPES = ["percent", "currency", "individuell"] as const;
export type SelectableMetricType = (typeof SELECTABLE_METRIC_TYPES)[number];

/** Der Typ, auf dem ein neu angelegtes Ziel startet — eine Prozentskala 0–100. */
export const DEFAULT_METRIC_TYPE: SelectableMetricType = "percent";

export function isMetricType(v: string | null | undefined): v is MetricType {
  return v != null && (METRIC_TYPES as readonly string[]).includes(v);
}

/** Wird dieser Typ noch angeboten? `false` für abgelegte wie „Zahl". */
export function isSelectableMetricType(v: string | null | undefined): v is SelectableMetricType {
  return v != null && (SELECTABLE_METRIC_TYPES as readonly string[]).includes(v);
}

/**
 * Die Beschriftungen — und der einzige exhaustive Guard der Kette: ein neuer
 * Metriktyp erzwingt hier einen Compile-Fehler (Record über MetricType).
 *
 * „Zahl" bleibt stehen, obwohl die Auswahl ihn nicht mehr führt: ein
 * Bestandsziel braucht ein Wort für das, worauf es steht.
 */
export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  number: "Zahl",
  percent: "Prozent",
  currency: "Währung",
  individuell: "Individuell",
};

/**
 * Baseline und Target eines **neu angelegten** Ziels.
 *
 * Eine Prozentskala hat Enden — 0 und 100 —, und die sollen dastehen, ohne dass
 * jemand sie tippt. Als Spalten-Default ginge das nicht: der Service schreibt
 * `baseline ?? null`, und gegen eine geschriebene Null kommt kein `@default` an.
 *
 * **Nur für Ziele, die selbst messen.** Ein Ziel, dessen Fortschritt aus den
 * Unterzielen kommt, hat keine eigene Skala; ein Confidence-Ziel bringt seine
 * mit (1–5, fest). Beiden eine 0–100-Skala anzuhängen wäre eine Zahl ohne
 * Bedeutung — und beim Confidence-Ziel eine, die eine Zeile später ohnehin
 * überschrieben wird.
 */
export function initialMetricScale(input: {
  metricType?: string | null | undefined;
  baseline?: number | null | undefined;
  target?: number | null | undefined;
  progressMode?: string | null | undefined;
}): { baseline: number | null; target: number | null } {
  const misstSelbst = input.progressMode !== "rollup" && input.progressMode !== "confidence";
  const prozent = misstSelbst && (input.metricType ?? DEFAULT_METRIC_TYPE) === "percent";
  return {
    baseline: input.baseline ?? (prozent ? 0 : null),
    target: input.target ?? (prozent ? 100 : null),
  };
}

/** Clamp a precision value into the allowed 0..6 range. */
export function clampPrecision(p: number | null | undefined): number {
  if (p == null || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(6, Math.trunc(p)));
}

interface MetricSpec {
  metricType?: string | null | undefined;
  precision?: number | null | undefined;
  currencyCode?: string | null | undefined;
  /** Freies Einheiten-Label — Suffix bei Typ „individuell". */
  metricUnit?: string | null | undefined;
}

/**
 * Formats a raw metric value for display according to the KR's metric type.
 * - number      → locale number with `precision` decimals
 * - percent     → number + " %"
 * - currency    → Intl currency (falls back to number if currencyCode missing)
 * - individuell → number + das freie Einheiten-Label (falls gesetzt)
 */
export function formatMetricValue(value: number | null | undefined, spec: MetricSpec): string {
  if (value == null || !Number.isFinite(value)) return "—";
  // Der Fallback auf „number" ist **kein Restbestand**: er faengt jeden Wert
  // ab, den das Vokabular nicht kennt, und landet damit im Else-Zweig unten —
  // der schlichten Zahl. Genau das laesst Bestandsziele auf „Zahl" unveraendert
  // aussehen, ohne dass sie je umgeschrieben werden muessten.
  const type: MetricType = isMetricType(spec.metricType) ? spec.metricType : "number";
  const precision = clampPrecision(spec.precision);

  if (type === "currency" && spec.currencyCode) {
    try {
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: spec.currencyCode,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value);
    } catch {
      // Ungültiger Währungscode → auf Zahl zurückfallen.
    }
  }

  const num = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);

  if (type === "percent") return `${num} %`;
  if (type === "individuell" && spec.metricUnit) return `${num} ${spec.metricUnit}`;
  return num;
}

/** Short unit suffix for chart axes/tooltips (" %", " €"/code, Label, or ""). */
export function metricUnitSuffix(spec: MetricSpec): string {
  const type: MetricType = isMetricType(spec.metricType) ? spec.metricType : "number";
  if (type === "percent") return " %";
  if (type === "currency" && spec.currencyCode) return ` ${spec.currencyCode}`;
  if (type === "individuell" && spec.metricUnit) return ` ${spec.metricUnit}`;
  return "";
}
