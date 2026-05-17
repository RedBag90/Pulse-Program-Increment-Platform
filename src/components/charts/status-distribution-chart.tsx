"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface StatusDataPoint {
  status: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(var(--muted-foreground) / 0.5)",
  in_review: "oklch(0.623 0.214 259.815)",
  approved: "oklch(0.627 0.194 149.214)",
  in_progress: "var(--primary)",
  blocked: "oklch(0.637 0.237 25.331)",
  completed: "oklch(0.627 0.194 149.214)",
  cancelled: "hsl(var(--muted-foreground) / 0.3)",
};

interface Props {
  data: StatusDataPoint[];
  /** Noun shown in the tooltip for the counted entity. */
  label?: string;
}

export function StatusDistributionChart({ data, label = "Epics" }: Props) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="status"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={(v: string) => v.replace("_", " ")}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          formatter={(value) => [value, label]}
          labelFormatter={(label) => String(label).replace("_", " ")}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "var(--primary)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
