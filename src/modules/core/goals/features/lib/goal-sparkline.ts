import type { ProgressChart } from "@/modules/core/goals/server/views/ziele-view";

/**
 * **Die Mini-Linie in der Ziele-Tabelle** — reine Umrechnung des großen
 * Fortschrittsgraphen (`ProgressChart`) in SVG-Koordinaten.
 *
 * - x-Achse = Zeitraum des Ziels (`pace`); ohne Zeitraum vom ersten Punkt bis
 *   heute. Punkte außerhalb werden an den Rand geklemmt.
 * - y-Achse = `yDomain`, oben = Ziel erreicht.
 * - Punkte: alle Status-Check-ins in ihrer Farbe (der jüngste markiert);
 *   Wert-Einträge ohne Status bekommen keinen.
 *
 * `null` = nichts zu zeichnen (leere Serie) — dann bleibt der Balken.
 */

export interface SparkDot {
  x: number;
  y: number;
  status: string;
  latest: boolean;
}

export interface SparkGeometry {
  /** Pfad der Verlaufslinie. */
  line: string;
  /** Geschlossene Fläche unter der Linie. */
  area: string;
  /** Gestrichelte Ideallinie über den Zeitraum; `null` ohne Zeitraum. */
  pace: { x1: number; y1: number; x2: number; y2: number } | null;
  /** x des „Heute"-Strichs, wenn heute im Zeitraum liegt. */
  today: number | null;
  dots: SparkDot[];
}

const TAG = 86_400_000;

export function sparklineGeometry(
  chart: ProgressChart,
  opts: { width: number; height: number; nowMs: number; pad?: number },
): SparkGeometry | null {
  const series = [...chart.series].sort((a, b) => a.at - b.at);
  if (series.length === 0) return null;
  const { width, height, nowMs } = opts;
  const pad = opts.pad ?? 3;

  const first = series[0]!;
  const last = series[series.length - 1]!;
  let x0 = chart.pace ? chart.pace.fromMs : first.at;
  let x1 = chart.pace ? chart.pace.toMs : Math.max(nowMs, last.at);
  if (x1 <= x0) x1 = x0 + TAG;
  let [y0, y1] = chart.yDomain;
  if (y1 === y0) y1 = y0 + 1;

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const sx = (t: number) => pad + ((clamp(t, x0, x1) - x0) / (x1 - x0)) * (width - 2 * pad);
  const sy = (v: number) =>
    height -
    pad -
    ((clamp(v, Math.min(y0, y1), Math.max(y0, y1)) - y0) / (y1 - y0)) * (height - 2 * pad);
  const r = (n: number) => Math.round(n * 10) / 10;

  // Ein einzelner Punkt wird zur waagrechten Linie bis heute — ein Punkt allein
  // ist keine Linie.
  const pts =
    series.length === 1
      ? [first, { ...first, at: Math.max(first.at, Math.min(nowMs, x1)) }]
      : series;
  const coords = pts.map((p) => [r(sx(p.at)), r(sy(p.value))] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  const bottom = r(height - pad);
  const area = `${line} L${coords[coords.length - 1]![0]} ${bottom} L${coords[0]![0]} ${bottom} Z`;

  const pace = chart.pace
    ? {
        x1: r(sx(chart.pace.fromMs)),
        y1: r(sy(chart.pace.from)),
        x2: r(sx(chart.pace.toMs)),
        y2: r(sy(chart.pace.to)),
      }
    : null;
  const today = nowMs > x0 && nowMs < x1 ? r(sx(nowMs)) : null;

  const mitStatus = series.filter((p) => p.status != null);
  const dots = mitStatus.map((p, i) => ({
    x: r(sx(p.at)),
    y: r(sy(p.value)),
    status: p.status!,
    latest: i === mitStatus.length - 1,
  }));

  return { line, area, pace, today, dots };
}
