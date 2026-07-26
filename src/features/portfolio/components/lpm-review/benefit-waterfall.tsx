"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LpmWaterfallStep } from "@/domain/lpm-review";
import { formatMioEUR } from "@/lib/formatting";
import { PLAN_GREY, tierHex, TOOLTIP_STYLE } from "./chart-theme";

/**
 * Benefit-Wasserfall — beantwortet „Wo geht Benefit verloren?". Start (Plan) und
 * Ende (Forecast) neutral grau, Verlustbeiträge je Value Stream rot. Umsetzung
 * als Stacked-Bar mit transparentem Offset-Balken (`base`) + sichtbarem Segment.
 */
interface WfBar {
  label: string;
  base: number;
  bar: number;
  kind: LpmWaterfallStep["kind"];
  /** Vorzeichenbehafteter Originalwert für den Tooltip. */
  value: number;
}

function toBars(steps: LpmWaterfallStep[]): WfBar[] {
  let running = 0;
  return steps.map((s) => {
    if (s.kind === "start") {
      running = s.value;
      return { label: s.label, base: 0, bar: s.value, kind: s.kind, value: s.value };
    }
    if (s.kind === "end") {
      return { label: s.label, base: 0, bar: s.value, kind: s.kind, value: s.value };
    }
    // loss: value < 0 — Balken von (running+value) nach running.
    const next = running + s.value;
    const b: WfBar = {
      label: s.label,
      base: next,
      bar: Math.abs(s.value),
      kind: s.kind,
      value: s.value,
    };
    running = next;
    return b;
  });
}

export function BenefitWaterfall({ steps }: { steps: LpmWaterfallStep[] }) {
  const data = toBars(steps);
  if (data.length === 0) return null;
  const color = (kind: LpmWaterfallStep["kind"]) => (kind === "loss" ? tierHex("rose") : PLAN_GREY);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval={0}
          tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + "…" : v)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatMioEUR(v)}
          width={72}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(_v, _n, item) => {
            const p = item.payload as WfBar;
            return [formatMioEUR(p.value), p.kind === "loss" ? "Verlust" : "Benefit"];
          }}
          labelFormatter={(l) => String(l)}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar
          dataKey="bar"
          stackId="wf"
          radius={[3, 3, 0, 0]}
          maxBarSize={64}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={color(d.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
