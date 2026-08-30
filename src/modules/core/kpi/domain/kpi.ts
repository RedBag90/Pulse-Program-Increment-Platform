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

/** Ein Messpunkt mit vorgerechnetem Zeitstempel — die Form der Stichtags-Suche. */
export interface KpiMeasurementPoint {
  atMs: number;
  value: number;
}

/**
 * Die Messreihe als aufsteigend sortierte Zeitpunkte. Einträge mit unlesbarem
 * Datum fallen weg — sie hätten in einer Stichtags-Suche keinen Platz.
 */
export function measurementPoints(measurements: KpiMeasurement[]): KpiMeasurementPoint[] {
  return measurements
    .map((m) => ({ atMs: Date.parse(m.date), value: m.value }))
    .filter((m) => !Number.isNaN(m.atMs))
    .sort((a, b) => a.atMs - b.atMs);
}

/**
 * Messwert zum Stichtag: letzter Messpunkt ≤ `cutoffMs`, sonst `fallback`.
 *
 * Erwartet eine **aufsteigend sortierte** Reihe (siehe {@link measurementPoints})
 * und bricht beim ersten späteren Punkt ab — das LPM-Review ruft das je Epic und
 * je Stichtag auf.
 *
 * Der `fallback` ist bewusst ein Parameter und nicht fest `null`: wer nach dem
 * *realisierten* Anteil fragt, will vor der ersten Messung die Baseline sehen
 * (also 0 % Zielerreichung), nicht „unbekannt".
 */
export function measurementValueAt(
  measurements: readonly KpiMeasurementPoint[],
  cutoffMs: number,
  fallback: number | null,
): number | null {
  let v = fallback;
  for (const m of measurements) {
    if (m.atMs <= cutoffMs) v = m.value;
    else break;
  }
  return v;
}
