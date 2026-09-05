/**
 * Metrik-Typ eines Key Results — bestimmt Formatierung, Achsen und Eingabe.
 * Pendant zu Asanas `goal.metric.unit` (percentage | none | currency).
 *
 * Getrennt vom freien Label `KeyResult.metricUnit` (z. B. „Kunden"): dieses
 * Feld steuert das *Verhalten*, jenes nur den Text.
 */

export const METRIC_TYPES = ["number", "percent", "currency", "individuell"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export function isMetricType(v: string | null | undefined): v is MetricType {
  return v != null && (METRIC_TYPES as readonly string[]).includes(v);
}

/**
 * Die Auswahl im Formular — und der einzige exhaustive Guard der Kette: ein
 * neuer Metriktyp erzwingt hier einen Compile-Fehler (Record über MetricType).
 */
export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  number: "Zahl",
  percent: "Prozent",
  currency: "Währung",
  individuell: "Individuell",
};

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
