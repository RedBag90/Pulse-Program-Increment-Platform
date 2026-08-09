"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { goalStatusColor } from "@/modules/core/goals/domain/goal-status";
import type {
  ProgressChartPoint,
  ProgressPace,
} from "@/modules/core/goals/server/views/ziele-view";

/**
 * Fortschritts-Verlaufsgraf des Ziel-Detail-Panels — die **einzige** Stelle, die
 * `recharts` (~150 kb gz) importiert. Wird von `goal-detail-panel.tsx` per
 * `next/dynamic` nachgeladen, damit recharts nicht im Initial-Bundle des
 * immer-gemounteten Ziel-Drawers landet (Perf: FCP/LCP der /ziele-Route).
 */
export function GoalProgressChart({
  data,
  yDomain,
  unitSuffix,
  pace,
}: {
  data: ProgressChartPoint[];
  yDomain: [number, number];
  unitSuffix: string;
  pace?: ProgressPace | null;
}) {
  // Achse ggf. bis zur Deadline erweitern, damit die Pace-Linie nicht abgeschnitten wird.
  const xs = data.map((d) => d.at);
  const dataMin = xs.length ? Math.min(...xs) : 0;
  const dataMax = xs.length ? Math.max(...xs) : 1;
  const xDomain: [number, number] = pace
    ? [Math.min(dataMin, pace.fromMs), Math.max(dataMax, pace.toMs)]
    : [dataMin, dataMax];

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="goalArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {/* „Expected pace"-Ideallinie (Baseline→Target über den Zeitraum). */}
          {pace && (
            <ReferenceLine
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.45}
              segment={[
                { x: pace.fromMs, y: pace.from },
                { x: pace.toMs, y: pace.to },
              ]}
            />
          )}
          <XAxis
            dataKey="at"
            type="number"
            scale="time"
            domain={xDomain}
            allowDataOverflow
            tick={{ fontSize: 11 }}
            tickFormatter={(ms: number) =>
              new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
            }
          />
          <YAxis domain={yDomain} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => `${v}${unitSuffix}`}
            labelFormatter={(ms) =>
              new Date(Number(ms)).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2.5}
            fill="url(#goalArea)"
            isAnimationActive={false}
            dot={StatusDot}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Recharts-Dot:
 *  - `status` gesetzt → gefüllter Kreis in der Status-Farbe (Status-Update);
 *  - `entry` (statusloser manueller Wert-Eintrag) → hohler neutraler Kreis;
 *  - reine Linien-Vertices (KPI-Verlauf / Rollup / Live-Ende) → kein Punkt.
 */
function StatusDot(props: {
  cx?: number;
  cy?: number;
  payload?: { status?: string | null; entry?: boolean };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return <g />;
  if (payload?.status != null) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={goalStatusColor(payload.status)}
        stroke="white"
        strokeWidth={1.5}
      />
    );
  }
  if (payload?.entry) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill="var(--background)"
        stroke={goalStatusColor(null)}
        strokeWidth={1.5}
      />
    );
  }
  return <g />;
}
