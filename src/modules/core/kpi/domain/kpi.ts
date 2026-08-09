// ---------------------------------------------------------------------------
// KPI measurement series — the time-ordered actuals stored on `Kpi.measurements`
// (JSON). Pure helpers, no I/O.
// ---------------------------------------------------------------------------

export interface KpiMeasurement {
  /** ISO date (YYYY-MM-DD) of the reading. */
  date: string;
  value: number;
}

/** Reads a stored `measurements` JSON value, discarding malformed entries. */
export function parseKpiMeasurements(raw: unknown): KpiMeasurement[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is KpiMeasurement =>
      m != null &&
      typeof m === "object" &&
      typeof (m as { date?: unknown }).date === "string" &&
      typeof (m as { value?: unknown }).value === "number",
  );
}

/** The most recent measurement value, or null when the series is empty. */
export function latestKpiValue(measurements: KpiMeasurement[]): number | null {
  if (measurements.length === 0) return null;
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1]!.value;
}
