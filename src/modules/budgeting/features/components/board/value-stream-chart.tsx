"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  valueStreamSeriesKey,
  type ChartRow,
  type ValueStreamRollup,
} from "@/modules/budgeting/domain/budgeting";
import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/formatting";

const VS_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#eab308", "#a78bfa", "#f59e0b", "#6366f1"];

interface Props {
  rollup: ValueStreamRollup[];
  /** Vom Page-Model vorberechnete Pivot-Zeilen (eine je Periode). */
  chartRows: ChartRow[];
}

/** Gestapelte Balken: Budget je Wertstrom und Halbjahr (REQ-B6). */
export function ValueStreamChart({ rollup, chartRows }: Props) {
  if (rollup.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-heading text-sm font-medium">Budget je Wertstrom &amp; Periode</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
          />
          <Tooltip
            formatter={(v: number | string | readonly (number | string)[] | undefined) =>
              formatEUR(Number(Array.isArray(v) ? v[0] : (v ?? 0)))
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {rollup.map((r, i) => (
            <Bar
              key={r.valueStreamId ?? "none"}
              dataKey={valueStreamSeriesKey(r)}
              stackId="vs"
              fill={VS_COLORS[i % VS_COLORS.length]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
