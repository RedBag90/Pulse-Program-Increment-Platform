"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatMioEUR } from "@/lib/formatting";
import { PLAN_GREY, tierHex, TOOLTIP_STYLE } from "./chart-theme";

/**
 * Divergierender Balken der Terminabweichung — beantwortet „Bei welchem Epic
 * zuerst handeln?". Nulllinie in der Mitte; Verzögerungen (positiv) als rote
 * Balken nach rechts, Vorlauf (negativ) grün nach links; sortiert nach Abweichung.
 * Balken-Tooltip trägt den Benefit des Epics.
 */
export interface ScheduleItem {
  name: string;
  /** Terminabweichung in PIs (positiv = Verzug). */
  delta: number;
  benefitPlan: number;
}

export function DivergingScheduleBar({ items }: { items: ScheduleItem[] }) {
  const data = [...items].sort((a, b) => b.delta - a.delta);
  if (data.length === 0) return null;
  const color = (d: number) => (d > 0 ? tierHex("rose") : d < 0 ? tierHex("green") : PLAN_GREY);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.delta)));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[-maxAbs, maxAbs]}
          tickCount={maxAbs * 2 + 1}
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          unit=" PI"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 20) + "…" : v)}
        />
        <ReferenceLine x={0} stroke="var(--foreground)" strokeOpacity={0.4} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(_v, _n, item) => {
            const p = item.payload as ScheduleItem;
            const label =
              p.delta > 0
                ? `+${p.delta} PI Verzug`
                : p.delta < 0
                  ? `${p.delta} PI Vorlauf`
                  : "im Plan";
            return [`${label} · ${formatMioEUR(p.benefitPlan)}`, "Termin"];
          }}
          labelFormatter={(l) => String(l)}
        />
        <Bar dataKey="delta" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={color(d.delta)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
