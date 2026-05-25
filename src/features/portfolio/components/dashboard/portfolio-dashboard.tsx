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
  type PortfolioSeries,
  type PortfolioEconomicsData,
} from "@/domain/portfolio-economics";
import { savePortfolioDashboardSettingsAction } from "@/features/portfolio/actions/dashboard-settings";
import { epicColor, VALUE_COLOR, COST_COLOR, BREAKEVEN_COLOR } from "./epic-colors";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: PortfolioEconomicsData;
  canEdit: boolean;
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const fmtEur = (v: number) => eur.format(Math.round(v));

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

export function PortfolioDashboard({ data, canEdit }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.epics.map((e) => e.id)));
  const [fromIso, setFromIso] = useState(data.axisFromIso);
  const [toIso, setToIso] = useState(data.horizonEndIso);

  // Stable colour per Epic, keyed by its position in the full (unfiltered) list.
  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    data.epics.forEach((e, i) => (map[e.id] = epicColor(i)));
    return map;
  }, [data.epics]);

  const series = useMemo(
    () => buildPortfolioSeries(data, { selectedEpicIds: selected, fromIso, toIso }),
    [data, selected, fromIso, toIso],
  );

  const months = series.axis.months;
  const ticks = months.map((m) => m.label).filter((l) => quarterTick(l) !== "");

  const benefitRows = useMemo(
    () => stackRows(series, (i, m) => series.perEpic[i]!.benefit[m] ?? 0),
    [series],
  );
  const costRows = useMemo(
    () => stackRows(series, (i, m) => series.perEpic[i]!.cost[m] ?? 0),
    [series],
  );
  const accValueRows = useMemo(
    () => stackRows(series, (i, m) => series.perEpic[i]!.accBenefit[m] ?? 0),
    [series],
  );
  const accCostRows = useMemo(
    () => stackRows(series, (i, m) => series.perEpic[i]!.accCost[m] ?? 0),
    [series],
  );
  const cashRows = useMemo(
    () => stackRows(series, (i, m) => series.perEpic[i]!.net[m] ?? 0),
    [series],
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

  const stacks = series.perEpic.map((e) => ({ id: e.id, title: e.title, color: colorById[e.id]! }));

  return (
    <div className="space-y-6">
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
      />

      {canEdit && (
        <SettingsEditor
          costNeutralTarget={data.costNeutralTarget}
          horizonEndIso={data.horizonEndIso}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Benefit Velocity"
          subtitle="Business Value je Monat — Linie = kostenneutraler Betrieb"
        >
          <StackedChart rows={benefitRows} stacks={stacks} ticks={ticks}>
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

        <Panel title="Cost Distribution" subtitle="Kosten je Monat, gestapelt nach Epic">
          <StackedChart rows={costRows} stacks={stacks} ticks={ticks} />
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
          <StackedChart rows={accValueRows} stacks={stacks} ticks={ticks} />
        </Panel>

        <Panel title="Cost Analysis" subtitle="Kumulierte Kosten">
          <StackedChart rows={accCostRows} stacks={stacks} ticks={ticks} />
        </Panel>

        <Panel
          title="Positiver und Negativer Cash-Flow"
          subtitle="Business Value − Kosten je Monat"
          className="xl:col-span-2"
        >
          <StackedChart rows={cashRows} stacks={stacks} ticks={ticks} height={320}>
            <ReferenceLine y={0} stroke="var(--border)" />
          </StackedChart>
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

function StackedChart({
  rows,
  stacks,
  ticks,
  height = 300,
  children,
}: {
  rows: Row[];
  stacks: { id: string; title: string; color: string }[];
  ticks: string[];
  height?: number;
  children?: ReactNode;
}) {
  if (stacks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Keine Epics ausgewählt.</p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis {...xAxis(ticks)} />
        <YAxis {...yAxis} />
        <Tooltip {...tooltip} />
        {children}
        {stacks.map((s) => (
          <Bar
            key={s.id}
            dataKey={s.id}
            name={s.title}
            stackId="a"
            fill={s.color}
            maxBarSize={14}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
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
    </Card>
  );
}

// --- settings editor (target line + horizon) -------------------------------

function SettingsEditor({
  costNeutralTarget,
  horizonEndIso,
}: {
  costNeutralTarget: number | null;
  horizonEndIso: string;
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
          <Label htmlFor="pd-horizon">Horizont-Ende</Label>
          <Input
            id="pd-horizon"
            name="horizonEndIso"
            type="date"
            className="w-44"
            defaultValue={horizonEndIso}
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
