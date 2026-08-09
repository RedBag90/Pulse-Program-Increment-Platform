/**
 * KPI-Messwerte liegen als JSON-Array `{ date, value }` an `Kpi.measurements`.
 * Reine Helfer zum Parsen — geteilt von Loader (Ziele-View) und Check-in-Service.
 */

export interface Measurement {
  /** ISO-Datum des Messpunkts. */
  at: string;
  value: number;
}

/** Parst das rohe `measurements`-JSON zu chronologisch sortierten Messpunkten. */
export function parseMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<{ date?: unknown; value?: unknown }>)
    .filter(
      (p): p is { date: string; value: number } =>
        typeof p.value === "number" && typeof p.date === "string",
    )
    .map((p) => ({ at: p.date, value: p.value }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Der zuletzt gemessene Wert (chronologisch letzter), oder `null`. */
export function latestMeasurement(raw: unknown): number | null {
  const pts = parseMeasurements(raw);
  return pts.length > 0 ? pts[pts.length - 1]!.value : null;
}
