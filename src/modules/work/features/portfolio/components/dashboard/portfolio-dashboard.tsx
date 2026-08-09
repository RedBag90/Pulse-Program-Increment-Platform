"use client";

import { useMemo, useState, useActionState, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  buildPortfolioSeries,
  groupSeriesByValueStream,
  type PortfolioSeries,
  type PortfolioEconomicsData,
} from "@/modules/work/domain/portfolio-economics";
import { savePortfolioDashboardSettingsAction } from "@/modules/work/features/portfolio/actions/dashboard-settings";
import { epicColor, VALUE_COLOR, COST_COLOR, BREAKEVEN_COLOR } from "./epic-colors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR as fmtEur } from "@/lib/formatting";

interface Props {
  data: PortfolioEconomicsData;
  canEdit: boolean;
}

/** Show an x-axis label only at quarter starts to keep the monthly axis legible. */
function quarterTick(label: string): string {
  const [mon] = label.split(" ");
  return mon === "Jan" || mon === "Apr" || mon === "Jul" || mon === "Oct" ? label : "";
}

type Row = Record<string, number | string>;

/** Builds one chart row per month, with one numeric key per active Epic. */
function stackRows(
  series: PortfolioSeries,
  pick: (epicIndex: number, month: number) => number,
): Row[] {
  return series.axis.months.map((mo, m) => {
    const row: Row = { label: mo.label };
    series.perEpic.forEach((e, i) => {
      row[e.id] = pick(i, m);
    });
    return row;
  });
}

/** Sensible default chart upper bound: latest go-live + 36 months, or +5 years from axis start. */
function defaultToIso(data: PortfolioEconomicsData): string {
  const goLives = data.epics
    .map((e) => Date.parse(`${e.goLiveIso}T00:00:00.000Z`))
    .filter((t) => !Number.isNaN(t));
  const anchorMs = goLives.length
    ? Math.max(...goLives)
    : Date.parse(`${data.axisFromIso}T00:00:00.000Z`);
  const anchor = new Date(anchorMs);
  const future = new Date(
    Date.UTC(
      anchor.getUTCFullYear() + (goLives.length ? 0 : 5),
      anchor.getUTCMonth() + (goLives.length ? 36 : 0),
      1,
    ),
  );
  return future.toISOString().slice(0, 10);
}

export function PortfolioDashboard({ data, canEdit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.epics.map((e) => e.id)));
  const [fromIso, setFromIso] = useState(data.axisFromIso);
  // Default upper bound: latest go-live + 36 months so the recurring benefit
  // has a long runway out of the box (axisFromIso + 5 years as a fallback).
  // The user can shorten or extend it freely via the Stichtag slicer.
  const [toIso, setToIso] = useState(() => defaultToIso(data));

  // Stable colour per Epic, keyed by its position in the full (unfiltered) list.
  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    data.epics.forEach((e, i) => (map[e.id] = epicColor(i)));
    return map;
  }, [data.epics]);

  // "Confirmed" cost = budget actually distributed in the Budgeting Meeting
  // (the Epic has an allocation). Otherwise the cost is a business-case estimate
  // and is drawn hatched in the cost charts.
  const confirmedById = useMemo(() => {
    const map: Record<string, boolean> = {};
    data.epics.forEach((e) => (map[e.id] = e.hasAllocation));
    return map;
  }, [data.epics]);

  const series = useMemo(
    () => buildPortfolioSeries(data, { selectedEpicIds: selected, fromIso, toIso }),
    [data, selected, fromIso, toIso],
  );

  // Darstellung: Standard nach Value Stream gebündelt, umschaltbar auf Epic-Sicht.
  const [groupMode, setGroupMode] = useState<"valueStream" | "epic">("valueStream");
  const vsByEpicId = useMemo(
    () => new Map(data.epics.map((e) => [e.id, e.valueStream] as const)),
    [data.epics],
  );
  const displaySeries = useMemo<PortfolioSeries>(
    () =>
      groupMode === "valueStream"
        ? { ...series, perEpic: groupSeriesByValueStream(series.perEpic, vsByEpicId) }
        : series,
    [series, groupMode, vsByEpicId],
  );
  // „confirmed" je Value-Stream-Gruppe: nur wenn ALLE Epics der Gruppe eine
  // Budget-Allocation haben, sonst schraffiert (wie im Epic-Modus je Epic).
  const confirmedByGroup = useMemo(() => {
    const members = new Map<string, boolean[]>();
    for (const e of data.epics) {
      const gid = e.valueStream != null ? `vs:${e.valueStream}` : "vs:__none__";
      (members.get(gid) ?? members.set(gid, []).get(gid)!).push(e.hasAllocation);
    }
    const map = new Map<string, boolean>();
    for (const [gid, arr] of members) map.set(gid, arr.every(Boolean));
    return map;
  }, [data.epics]);

  const months = series.axis.months;
  const ticks = months.map((m) => m.label).filter((l) => quarterTick(l) !== "");

  const benefitRows = useMemo(
    () => stackRows(displaySeries, (i, m) => displaySeries.perEpic[i]!.benefit[m] ?? 0),
    [displaySeries],
  );
  const costRows = useMemo(
    () => stackRows(displaySeries, (i, m) => displaySeries.perEpic[i]!.cost[m] ?? 0),
    [displaySeries],
  );
  const accValueRows = useMemo(
    () => stackRows(displaySeries, (i, m) => displaySeries.perEpic[i]!.accBenefit[m] ?? 0),
    [displaySeries],
  );
  const accCostRows = useMemo(
    () => stackRows(displaySeries, (i, m) => displaySeries.perEpic[i]!.accCost[m] ?? 0),
    [displaySeries],
  );
  const roiRows = useMemo(
    () =>
      months.map((mo, m) => ({
        label: mo.label,
        value: series.velocity[m] ?? 0,
        cost: series.costs[m] ?? 0,
      })),
    [series, months],
  );
  const breakEvenRows = useMemo(
    () =>
      months.map((mo, m) => ({
        label: mo.label,
        accValue: series.accBV[m] ?? 0,
        accCost: series.accCost[m] ?? 0,
        net: series.breakEven[m] ?? 0,
      })),
    [series, months],
  );

  const breakEvenLabel =
    series.breakEvenIndex != null ? months[series.breakEvenIndex]?.label : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Stacks der aktiven Sicht: im VS-Modus je Gruppe (Farbe nach Position), im
  // Epic-Modus je Epic (stabile Epic-Farbe/Allocation).
  const displayStacks = displaySeries.perEpic.map((e, i) => ({
    id: e.id,
    title: e.title,
    color: groupMode === "valueStream" ? epicColor(i) : colorById[e.id]!,
    confirmed:
      groupMode === "valueStream"
        ? (confirmedByGroup.get(e.id) ?? false)
        : (confirmedById[e.id] ?? false),
  }));
  const stackedBy = groupMode === "valueStream" ? "Value Stream" : "Epic";

  return (
    <div className="space-y-6">
      <HatchDefs stacks={displayStacks} />
      <Slicers
        epics={data.epics}
        selected={selected}
        colorById={colorById}
        onToggle={toggle}
        onAll={() => setSelected(new Set(data.epics.map((e) => e.id)))}
        onNone={() => setSelected(new Set())}
        fromIso={fromIso}
        toIso={toIso}
        onFrom={setFromIso}
        onTo={setToIso}
        groupMode={groupMode}
        onGroupMode={setGroupMode}
      />

      {canEdit && (
        <SettingsEditor
          costNeutralTarget={data.costNeutralTarget}
          costPerJobSizePoint={data.costPerJobSizePoint}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Benefit Velocity"
          subtitle="Business Value je Monat — Linie = kostenneutraler Betrieb"
        >
          <StackedChart rows={benefitRows} stacks={displayStacks} ticks={ticks}>
            {data.costNeutralTarget != null && (
              <ReferenceLine
                y={data.costNeutralTarget}
                stroke={COST_COLOR}
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
              />
            )}
          </StackedChart>
        </Panel>

        <Panel title="Cost Distribution" subtitle={`Kosten je Monat, gestapelt nach ${stackedBy}`}>
          <StackedChart rows={costRows} stacks={displayStacks} ticks={ticks} hatchUnconfirmed />
        </Panel>

        <Panel title="ROI" subtitle="Business Value (grün) vs. Kosten (rot) je Monat">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={roiRows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis {...xAxis(ticks)} />
              <YAxis {...yAxis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" name="Business Value" fill={VALUE_COLOR} maxBarSize={10} />
              <Bar dataKey="cost" name="Kosten" fill={COST_COLOR} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title="Break Even Analyse"
          subtitle={
            breakEvenLabel ? `Break-even: ${breakEvenLabel}` : "Kein Break-even im Zeitraum"
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={breakEvenRows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis {...xAxis(ticks)} />
              <YAxis {...yAxis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Line
                type="monotone"
                dataKey="accValue"
                name="Σ Business Value"
                stroke={VALUE_COLOR}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="accCost"
                name="Σ Kosten"
                stroke={COST_COLOR}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Break Even"
                stroke={BREAKEVEN_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Gained Value Analyse" subtitle="Kumulierter Business Value">
          <StackedChart rows={accValueRows} stacks={displayStacks} ticks={ticks} />
        </Panel>

        <Panel title="Cost Analysis" subtitle="Kumulierte Kosten">
          <StackedChart rows={accCostRows} stacks={displayStacks} ticks={ticks} hatchUnconfirmed />
        </Panel>

        <Panel
          title="Positiver und Negativer Cash-Flow"
          subtitle={`Laufender kumulierter Saldo je ${stackedBy} — negative unterhalb, positive oberhalb der 0-Linie`}
          className="xl:col-span-2"
        >
          <CashFlowChart series={displaySeries} stacks={displayStacks} ticks={ticks} />
        </Panel>
      </div>
    </div>
  );
}

// --- shared chart config ---------------------------------------------------

const yAxis = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
  tickFormatter: (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`),
} as const;

function xAxis(ticks: string[]) {
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

const tooltip = {
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

interface Stack {
  id: string;
  title: string;
  color: string;
  confirmed: boolean;
}

/**
 * SVG hatch patterns (one per Epic colour) referenced by `url(#hatch-<id>)` from
 * the cost charts. Rendered once, hidden; pattern defs resolve by id across the
 * whole document, so Recharts bars can fill from them.
 */
function HatchDefs({ stacks }: { stacks: Stack[] }) {
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

/** Legend explaining solid (allocated) vs hatched (estimated) cost bars. */
function CostLegend() {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
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
    </div>
  );
}

function StackedChart({
  rows,
  stacks,
  ticks,
  height = 300,
  hatchUnconfirmed = false,
  children,
}: {
  rows: Row[];
  stacks: Stack[];
  ticks: string[];
  height?: number;
  /** Draw Epics without a budgeting allocation with a hatched fill (cost charts). */
  hatchUnconfirmed?: boolean;
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
          <Tooltip {...tooltip} />
          {children}
          {stacks.map((s) => {
            const estimated = hatchUnconfirmed && !s.confirmed;
            return (
              <Bar
                key={s.id}
                dataKey={s.id}
                name={estimated ? `${s.title} (veranschlagt)` : s.title}
                stackId="a"
                fill={estimated ? `url(#hatch-${s.id})` : s.color}
                maxBarSize={14}
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
      {hatchUnconfirmed && <CostLegend />}
    </>
  );
}

/**
 * Cash-flow chart: each Epic's **running cumulative net** (`accNet =
 * accBenefit − accCost`) split into a positive half (stacked upward from 0)
 * and a negative half (stacked downward from 0), both sharing one stackId so
 * every month forms a single column. So Epic 1 with cumulative −350 € shows
 * one bar from 0 down to −350 €, while Epic 2 with cumulative +100 € shows
 * one bar from 0 up to +100 € in the same column. A flat month (no movement)
 * keeps the running total unchanged — the bar stays at the previous value.
 * Estimated (un-allocated) Epics are hatched.
 */
function CashFlowChart({
  series,
  stacks,
  ticks,
}: {
  series: PortfolioSeries;
  stacks: Stack[];
  ticks: string[];
}) {
  if (stacks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Keine Epics ausgewählt.</p>
    );
  }
  const rows: Row[] = series.axis.months.map((mo, m) => {
    const row: Row = { label: mo.label };
    series.perEpic.forEach((e) => {
      const v = e.accNet[m] ?? 0;
      row[`${e.id}#pos`] = v > 0 ? v : 0;
      row[`${e.id}#neg`] = v < 0 ? v : 0;
    });
    return row;
  });
  return (
    <>
      <ResponsiveContainer width="100%" height={320}>
        {/* stackOffset="sign" keeps the column shared (positives + negatives
            in the same `stackId`) but tells Recharts to use diverging
            accumulators — positives stack upward from 0, negatives downward
            from 0. Without it, Recharts sums every bar in the stack
            sequentially regardless of sign, which leaves negative segments
            recessed inside the positive stack and never dipping below 0. */}
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis {...xAxis(ticks)} />
          <YAxis {...yAxis} />
          <Tooltip
            content={({ active, payload, label }) => (
              <CashTooltip
                active={active}
                payload={payload as unknown as readonly CashPayloadItem[] | undefined}
                label={typeof label === "string" ? label : ""}
                stacks={stacks}
              />
            )}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          {stacks.flatMap((s) => {
            const fill = s.confirmed ? s.color : `url(#hatch-${s.id})`;
            return [
              <Bar
                key={`${s.id}#pos`}
                dataKey={`${s.id}#pos`}
                stackId="cashflow"
                fill={fill}
                maxBarSize={14}
              />,
              <Bar
                key={`${s.id}#neg`}
                dataKey={`${s.id}#neg`}
                stackId="cashflow"
                fill={fill}
                maxBarSize={14}
              />,
            ];
          })}
        </BarChart>
      </ResponsiveContainer>
      <CostLegend />
    </>
  );
}

interface CashPayloadItem {
  dataKey?: string | number;
  value?: number;
}

/** Tooltip that recombines each Epic's #pos/#neg parts into one signed line. */
function CashTooltip({
  active,
  payload,
  label,
  stacks,
}: {
  active?: boolean | undefined;
  payload?: readonly CashPayloadItem[] | undefined;
  label?: string | undefined;
  stacks: Stack[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const valueById = new Map<string, number>();
  for (const p of payload) {
    const key = typeof p.dataKey === "string" ? p.dataKey : "";
    const id = key.split("#")[0] ?? "";
    valueById.set(id, (valueById.get(id) ?? 0) + (typeof p.value === "number" ? p.value : 0));
  }
  return (
    <div
      style={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        fontSize: 12,
        color: "var(--popover-foreground)",
        padding: "8px 10px",
      }}
    >
      <p className="mb-1 font-medium">{label}</p>
      {stacks.map((s) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
          <span>
            {s.title}: {fmtEur(valueById.get(s.id) ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({
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

// --- slicers ---------------------------------------------------------------

function Slicers({
  epics,
  selected,
  colorById,
  onToggle,
  onAll,
  onNone,
  fromIso,
  toIso,
  onFrom,
  onTo,
  groupMode,
  onGroupMode,
}: {
  epics: PortfolioEconomicsData["epics"];
  selected: Set<string>;
  colorById: Record<string, string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
  fromIso: string;
  toIso: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  groupMode: "valueStream" | "epic";
  onGroupMode: (m: "valueStream" | "epic") => void;
}) {
  return (
    <Card className="flex flex-wrap items-start gap-x-8 gap-y-4 p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-sm font-medium">Projekt-ID</h2>
          <button onClick={onAll} className="text-xs text-primary hover:underline">
            Alle
          </button>
          <button onClick={onNone} className="text-xs text-primary hover:underline">
            Keine
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {epics.map((e) => {
            const on = selected.has(e.id);
            return (
              <button
                key={e.id}
                onClick={() => onToggle(e.id)}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  on ? "bg-muted" : "opacity-50 hover:opacity-100"
                }`}
                title={e.title}
              >
                <span className="size-2 rounded-full" style={{ background: colorById[e.id] }} />
                <span className="max-w-[10rem] truncate">{e.title}</span>
              </button>
            );
          })}
          {epics.length === 0 && (
            <span className="text-xs text-muted-foreground">Keine Epics mit Business Case.</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-sm font-medium">Stichtag</h2>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-40"
            value={fromIso}
            onChange={(e) => onFrom(e.target.value)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            className="w-40"
            value={toIso}
            onChange={(e) => onTo(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-sm font-medium">Ansicht</h2>
        <div className="inline-flex rounded-full border p-0.5 text-xs">
          {(
            [
              ["valueStream", "Nach Value Stream"],
              ["epic", "Nach Epic"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onGroupMode(mode)}
              aria-pressed={groupMode === mode}
              className={`rounded-full px-3 py-1 transition-colors ${
                groupMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

// --- settings editor (cost-neutral target line) ----------------------------

function SettingsEditor({
  costNeutralTarget,
  costPerJobSizePoint,
}: {
  costNeutralTarget: number | null;
  costPerJobSizePoint: number | null;
}) {
  const [state, formAction, pending] = useActionState(savePortfolioDashboardSettingsAction, {});
  return (
    <Card className="p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pd-target">Zielwert kostenneutraler Betrieb (€/Monat)</Label>
          <Input
            id="pd-target"
            name="costNeutralTarget"
            type="number"
            min={0}
            step={100}
            className="w-52"
            defaultValue={costNeutralTarget ?? ""}
            placeholder="z. B. 100"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pd-cpj">€ pro WSJF-Job-Size-Punkt</Label>
          <Input
            id="pd-cpj"
            name="costPerJobSizePoint"
            type="number"
            min={0}
            step={100}
            className="w-52"
            defaultValue={costPerJobSizePoint ?? ""}
            placeholder="leer = €-Achse aus"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Speichert…" : "Speichern"}
        </Button>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">Gespeichert.</p>}
      </form>
    </Card>
  );
}
