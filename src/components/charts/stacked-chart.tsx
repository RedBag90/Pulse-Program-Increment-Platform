"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { formatEUR as fmtEur } from "@/lib/formatting";
import {
  StackTooltip,
  stackLabel,
  type Stack,
  type StackPayloadItem,
} from "@/components/charts/stack-tooltip";

/**
 * Die gestapelten Zeitreihen-Charts — Bausteine, keine Fläche.
 *
 * Sie lagen modul-privat im Portfolio-Dashboard und wurden dort an dreizehn
 * Stellen benutzt. Der Budget-Verlauf von ART und Wertstrom braucht dieselben
 * Bausteine: konstante Monatsachse, Heute-Linie, Ist/Forecast-Deckkraft,
 * Schraffur für Veranschlagtes. Zwei Fassungen davon liefen unweigerlich
 * auseinander.
 *
 * Bewusst **nicht** mitgewandert ist `CashFlowChart`: es trägt eine eigene
 * Fachaussage (Saldo positiv/negativ um die Nulllinie) und hat außerhalb des
 * Dashboards keinen Nutzer. Geteilt wird, was geteilt wird.
 *
 * Die Achse ist strukturell typisiert (`ChartMonth`) statt über den
 * `PortfolioSeries`-Typ aus Work — sonst hinge ein geteilter Baustein an einem
 * Fachmodul.
 */

/** Ein Monat der Achse — strukturell kompatibel zu `MonthAxis["months"]`. */
export interface ChartMonth {
  key: string;
  label: string;
}

/** Deckkraft der Forecast-Monate (Zukunft, > heute) — Zeit-Konfidenz-Achse. */
export const FORECAST_OPACITY = 0.4;

/** Show an x-axis label only at quarter starts to keep the monthly axis legible. */
export function quarterTick(label: string): string {
  const [mon] = label.split(" ");
  return mon === "Jan" || mon === "Apr" || mon === "Jul" || mon === "Oct" ? label : "";
}

/**
 * Vertikale „heute"-Linie am Monat des `todayIndex` (Ist/Forecast-Grenze). Nur
 * gerendert, wenn heute im sichtbaren Fenster liegt.
 */
export function TodayLine({
  months,
  todayIndex,
}: {
  months: readonly ChartMonth[];
  todayIndex: number;
}) {
  if (todayIndex < 0 || todayIndex >= months.length) return null;
  const label = months[todayIndex]?.label;
  if (!label) return null;
  return (
    <ReferenceLine
      x={label}
      stroke="var(--muted-foreground)"
      strokeDasharray="2 3"
      strokeOpacity={0.7}
      label={{ value: "heute", position: "top", fontSize: 10, fill: "var(--muted-foreground)" }}
    />
  );
}

export type Row = Record<string, number | string>;

// --- shared chart config ---------------------------------------------------

export const yAxis = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
  tickFormatter: (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`),
} as const;

export function xAxis(ticks: string[]) {
  return {
    dataKey: "label",
    ticks,
    interval: 0 as const,
    tick: { fontSize: 10, fill: "var(--muted-foreground)" },
    angle: -45,
    textAnchor: "end" as const,
    height: 48,
    axisLine: false,
    tickLine: false,
  };
}

export const tooltip = {
  formatter: (value: number | string | readonly (number | string)[] | undefined) =>
    fmtEur(Number(Array.isArray(value) ? value[0] : (value ?? 0))),
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontSize: 12,
    color: "var(--popover-foreground)",
  },
};

/**
 * Die Füllung einer Serie: solide für freigegebenes Budget, schraffiert für
 * veranschlagtes. Gilt in **allen** gestapelten Charts — ein Nutzen aus einem
 * unfinanzierten Epic ist genauso veranschlagt wie dessen Kosten.
 */
export function fillOf(s: Stack): string {
  return s.confirmed ? s.color : `url(#hatch-${s.id})`;
}

export function HatchDefs({ stacks }: { stacks: Stack[] }) {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        {stacks.map((s) => (
          <pattern
            key={s.id}
            id={`hatch-${s.id}`}
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={s.color} opacity="0.25" />
            <line x1="0" y1="0" x2="0" y2="6" stroke={s.color} strokeWidth="3" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Chart-Legende der beiden orthogonalen Konfidenz-Achsen: Funding (freigegeben
 * vs. veranschlagt — nur `hatch`-Charts) und Zeit (Ist vs. Forecast/Zukunft —
 * `forecast`, reduzierte Deckkraft rechts der „heute"-Linie).
 */
export function ChartLegend({
  hatch = false,
  forecast = false,
}: {
  hatch?: boolean;
  forecast?: boolean;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {hatch && (
        <>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "var(--muted-foreground)" }}
            />
            freigegebenes Budget
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-border"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 4px)",
              }}
            />
            veranschlagt (nicht freigegeben)
          </span>
        </>
      )}
      {forecast && (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--muted-foreground)", opacity: FORECAST_OPACITY }}
          />
          Forecast (Zukunft, ab „heute")
        </span>
      )}
    </div>
  );
}

export function StackedChart({
  rows,
  stacks,
  ticks,
  months,
  todayIndex,
  height = 300,
  uplift = false,
  children,
}: {
  rows: Row[];
  stacks: Stack[];
  ticks: string[];
  months: readonly ChartMonth[];
  /** Ist/Forecast-Grenze: Monate mit Index > todayIndex = Zukunft (transparent). */
  todayIndex: number;
  height?: number;
  /** Benefit-Velocity: zusätzliches Forecast-Segment `${id}#up` (Rest zum Plan). */
  uplift?: boolean;
  children?: ReactNode;
}) {
  if (stacks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Keine Epics ausgewählt.</p>
    );
  }
  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis {...xAxis(ticks)} />
          <YAxis {...yAxis} />
          <Tooltip
            content={({ active, payload, label }) => (
              <StackTooltip
                active={active}
                payload={payload as unknown as readonly StackPayloadItem[] | undefined}
                label={typeof label === "string" ? label : ""}
                stacks={stacks}
              />
            )}
          />
          <TodayLine months={months} todayIndex={todayIndex} />
          {children}
          {stacks.map((s) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={stackLabel(s)}
              stackId="a"
              fill={fillOf(s)}
              maxBarSize={14}
            >
              {rows.map((_, m) => (
                <Cell
                  key={m}
                  fill={fillOf(s)}
                  fillOpacity={m > todayIndex ? FORECAST_OPACITY : 1}
                />
              ))}
            </Bar>
          ))}
          {uplift &&
            stacks.map((s) => (
              <Bar
                key={`${s.id}#up`}
                dataKey={`${s.id}#up`}
                name={`${stackLabel(s)} · Forecast`}
                stackId="a"
                // Dieselbe Füllung wie die Basis-Bar — auf einer schraffierten
                // Serie wäre ein solides Forecast-Segment ein Widerspruch.
                fill={fillOf(s)}
                fillOpacity={FORECAST_OPACITY}
                maxBarSize={14}
                legendType="none"
              />
            ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend hatch forecast />
    </>
  );
}

export function Panel({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`p-4 ${className ?? ""}`}>
      <div className="mb-3">
        <h2 className="font-heading text-sm font-medium">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}
