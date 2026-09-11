"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Kumulierte Kosten gegen kumulierten Nutzen, mit dem Break-even als Markierung.
 *
 * Die Chart-Schicht kannte bisher nur Balken (`stacked-chart` fürs Portfolio,
 * `wsjf-bar`, `status-distribution`). Der Rechen-Reiter eines Epics führte
 * Break-even deshalb als Spalte „Netto" in einer Tabelle — eine Aussage, die
 * eine Kurve in einem Blick gibt und eine Zahlenspalte nicht.
 *
 * Rein präsentational und thematreu: jede Farbe kommt aus einem Token, keine
 * feste Rampe. Die Achse ist dieselbe Monatsachse, die `epicFlows` liefert —
 * dieselbe Quelle, aus der auch die Tabelle darunter rechnet.
 */
export interface BreakEvenPoint {
  /** `yyyy-mm`. */
  month: string;
  cumCost: number;
  cumBenefit: number;
  isForecast: boolean;
}

const eur = (n: number): string =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio €`
    : Math.abs(n) >= 1_000
      ? `${Math.round(n / 1_000).toLocaleString("de-DE")} T€`
      : `${Math.round(n).toLocaleString("de-DE")} €`;

const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${m}/${y?.slice(2)}`;
};

export function BreakEvenChart({
  points,
  breakEvenMonth,
  height = 220,
}: {
  points: readonly BreakEvenPoint[];
  /** `yyyy-mm` des Break-even, oder `null` — dann fehlt die Markierung. */
  breakEvenMonth: string | null;
  height?: number;
}) {
  if (points.length === 0) return null;
  const firstForecast = points.find((p) => p.isForecast)?.month ?? null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={points as BreakEvenPoint[]}
        margin={{ top: 6, right: 8, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={eur}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => monthLabel(String(v))}
          formatter={(value, name) => [
            eur(typeof value === "number" ? value : Number(value ?? 0)),
            name === "cumBenefit" ? "Σ Nutzen" : "Σ Kosten",
          ]}
        />
        {/* Ist/Forecast-Grenze — dieselbe Unterscheidung, welche die Tabelle
            darunter kursiv setzt. */}
        {firstForecast && (
          <ReferenceLine
            x={firstForecast}
            stroke="var(--border)"
            strokeDasharray="4 3"
            label={{
              value: "Forecast",
              position: "insideTopLeft",
              fontSize: 10,
              fill: "var(--muted-foreground)",
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="cumBenefit"
          stroke="var(--chart-2)"
          fill="var(--chart-2)"
          fillOpacity={0.12}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="cumCost"
          stroke="var(--chart-5)"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
        />
        {breakEvenMonth && (
          <ReferenceLine
            x={breakEvenMonth}
            stroke="var(--primary)"
            strokeWidth={1.5}
            label={{ value: "Break-even", position: "top", fontSize: 10, fill: "var(--primary)" }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
