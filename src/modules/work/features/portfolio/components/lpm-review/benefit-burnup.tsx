"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { LpmBurnupPoint } from "@/modules/work/domain/lpm-review";
import { formatMioEUR } from "@/lib/formatting";
import { ACCENT, PLAN_GREY, TOOLTIP_STYLE } from "./chart-theme";

/**
 * Benefit-Burn-up — beantwortet „Öffnet/schließt sich die Schere?". Kumulierter
 * Plan-Benefit (grau) gegen realisierten Benefit (blau), ab Stichtag als
 * gestrichelte Forecast-Linie fortgesetzt. `realizedCum`/`forecastCum` sind
 * null jenseits ihres Bereichs → Recharts zeichnet dort keine Punkte.
 */
export function BenefitBurnup({ points }: { points: LpmBurnupPoint[] }) {
  if (points.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatMioEUR(v)}
          width={72}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [value == null ? "—" : formatMioEUR(Number(value)), name]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="plannedCum"
          name="Plan"
          stroke={PLAN_GREY}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="realizedCum"
          name="Realisiert"
          stroke={ACCENT}
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="forecastCum"
          name="Forecast"
          stroke={ACCENT}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
