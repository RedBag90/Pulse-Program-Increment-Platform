"use client";

import {
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { LpmAmpel } from "@/modules/work/domain/lpm-review";
import { formatMioEUR } from "@/lib/formatting";
import { tierHex, TOOLTIP_STYLE } from "./chart-theme";

/**
 * Portfolio-Matrix (Bubble): x = Plantreue %, y = Performance %, Blasengröße =
 * Benefit, Farbe = Ampel. Schwellenlinien bei 90 % auf beiden Achsen. Punkte
 * ohne Liefer-Signal (Plantreue/Performance null) werden ausgelassen. Dient auf
 * VS- wie Epic-Ebene (der Aufrufer filtert die Epic-Ebene je Value Stream).
 */
export interface BubblePoint {
  name: string;
  plantreue: number | null;
  performance: number | null;
  benefitPlan: number;
  ampel: LpmAmpel;
}

interface Plotted {
  name: string;
  x: number;
  y: number;
  z: number;
  ampel: LpmAmpel;
}

export function PortfolioBubbleMatrix({
  points,
  threshold = 90,
}: {
  points: BubblePoint[];
  threshold?: number;
}) {
  const data: Plotted[] = points
    .filter((p) => p.plantreue != null && p.performance != null)
    .map((p) => ({
      name: p.name,
      x: Math.round(p.plantreue! * 100),
      y: Math.round(p.performance! * 100),
      z: Math.max(1, p.benefitPlan),
      ampel: p.ampel,
    }));

  if (data.length === 0) {
    return (
      <div className="grid h-[260px] place-items-center text-xs text-muted-foreground">
        Keine Liefer-Kennzahlen zum Stichtag verfügbar.
      </div>
    );
  }

  const maxY = Math.max(100, ...data.map((d) => d.y));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          name="Plantreue"
          unit="%"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Performance"
          unit="%"
          domain={[0, maxY]}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <ZAxis type="number" dataKey="z" range={[80, 700]} name="Benefit" />
        <ReferenceLine x={threshold} stroke="var(--border)" strokeDasharray="4 3" />
        <ReferenceLine y={threshold} stroke="var(--border)" strokeDasharray="4 3" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name, item) => {
            const p = item.payload as Plotted;
            if (name === "Benefit") return [formatMioEUR(p.z), "Benefit"];
            return [`${value} %`, name];
          }}
          labelFormatter={(_l, payload) =>
            payload && payload[0] ? (payload[0].payload as Plotted).name : ""
          }
        />
        <Scatter data={data} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={tierHex(d.ampel)} fillOpacity={0.7} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
