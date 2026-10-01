"use client";

import { goalStatusColor } from "@/modules/core/goals/domain/goal-status";
import { sparklineGeometry } from "@/modules/core/goals/features/lib/goal-sparkline";
import type { ProgressChart } from "@/modules/core/goals/server/views/ziele-view";

/** Größe der Mini-Linie (CSS-Pixel). */
export const SPARK_W = 100;
export const SPARK_H = 26;

/**
 * **Mini-Verlauf eines Ziels** — der große Fortschrittsgraph als Schema: keine
 * Achsen, keine Beschriftung. Die Linie läuft entlang des Zeitraums, die
 * gestrichelte Ideallinie zeigt, wo das Ziel heute stehen müsste, der feine
 * senkrechte Strich ist heute. Jedes Status-Update ist ein kleiner Punkt in
 * seiner Farbe, der jüngste etwas größer.
 *
 * Gibt `null` zurück, wenn es nichts zu zeichnen gibt — dann bleibt der Balken.
 */
export function GoalSparkline({
  chart,
  label,
  nowMs,
}: {
  chart: ProgressChart;
  label: string;
  nowMs: number;
}) {
  const g = sparklineGeometry(chart, { width: SPARK_W, height: SPARK_H, nowMs });
  if (!g) return null;
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      role="img"
      aria-label={label}
      className="shrink-0 overflow-visible"
    >
      <title>{label}</title>
      {g.today != null && (
        <line
          x1={g.today}
          x2={g.today}
          y1={1}
          y2={SPARK_H - 1}
          className="stroke-border"
          strokeWidth={1}
        />
      )}
      {g.pace && (
        <line
          x1={g.pace.x1}
          y1={g.pace.y1}
          x2={g.pace.x2}
          y2={g.pace.y2}
          className="stroke-muted-foreground/40"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <path d={g.area} className="fill-primary/10" stroke="none" />
      <path
        d={g.line}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {g.dots.map((d) => (
        <circle
          key={`${d.x}-${d.y}`}
          cx={d.x}
          cy={d.y}
          r={d.latest ? 2.6 : 1.6}
          fill={goalStatusColor(d.status)}
          className="stroke-background"
          strokeWidth={d.latest ? 1 : 0.6}
        />
      ))}
    </svg>
  );
}
