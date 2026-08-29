"use client";

import { useMemo, useState, useActionState, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  Cell,
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
  groupSeriesByEstimatedStage,
  type PortfolioSeries,
  type PortfolioEconomicsData,
} from "@/modules/work/domain/portfolio-economics";
import type { StageTransition } from "@/modules/work/domain/epic-stage-timeline";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { savePortfolioDashboardSettingsAction } from "@/modules/work/features/portfolio/actions/dashboard-settings";
import {
  EpicFacetFilterBar,
  type FlagFilter,
} from "@/modules/work/features/portfolio/components/epic-facet-filter-bar";
import { matchesQuery } from "@/modules/work/lib/row-filter";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { epicColor, VALUE_COLOR, COST_COLOR, BREAKEVEN_COLOR } from "./epic-colors";
import { GoalBenefitWaterfallSection } from "./goal-benefit-waterfall";
import type { GoalWaterfallData } from "@/modules/work/domain/goal-benefit-waterfall";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEUR as fmtEur } from "@/lib/formatting";

interface Props {
  data: PortfolioEconomicsData;
  canEdit: boolean;
  goalWaterfalls: GoalWaterfallData;
}

type GroupMode = "valueStream" | "art" | "epic" | "status";

/** Deckkraft der Forecast-Monate (Zukunft, > heute) — Zeit-Konfidenz-Achse. */
const FORECAST_OPACITY = 0.4;

/** Stage-Gate (L0–L5) → Anzeigename für die „Nach Status"-Gruppierung. */
const STAGE_LABELS: Record<StageGate, string> = {
  L0: "L0 · Funnel",
  L1: "L1 · Detailing",
  L2: "L2 · Analyse",
  L3: "L3 · Backlog",
  L4: "L4 · Umsetzung",
  L5: "L5 · Impact",
};

/** Sequenzielle Farbrampe L0 (früh, grau) → L5 (Impact, grün). */
const STAGE_COLORS: Record<StageGate, string> = {
  L0: "#94a3b8",
  L1: "#60a5fa",
  L2: "#38bdf8",
  L3: "#818cf8",
  L4: "#f59e0b",
  L5: "#22c55e",
};

/** Gate einer Status-Gruppen-Serie aus ihrem Titel (die Gruppe setzt title=gate). */
function stageOf(title: string): StageGate {
  return (["L0", "L1", "L2", "L3", "L4", "L5"] as const).includes(title as StageGate)
    ? (title as StageGate)
    : "L0";
}

/** Show an x-axis label only at quarter starts to keep the monthly axis legible. */
function quarterTick(label: string): string {
  const [mon] = label.split(" ");
  return mon === "Jan" || mon === "Apr" || mon === "Jul" || mon === "Oct" ? label : "";
}

/**
 * Vertikale „heute"-Linie am Monat des `todayIndex` (Ist/Forecast-Grenze). Nur
 * gerendert, wenn heute im sichtbaren Fenster liegt.
 */
function TodayLine({
  months,
  todayIndex,
}: {
  months: PortfolioSeries["axis"]["months"];
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

export function PortfolioDashboard({ data, canEdit, goalWaterfalls }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.epics.map((e) => e.id)));
  const [fromIso, setFromIso] = useState(data.axisFromIso);
  // Default upper bound: latest go-live + 36 months so the recurring benefit
  // has a long runway out of the box (axisFromIso + 5 years as a fallback).
  // The user can shorten or extend it freely via the Stichtag slicer.
  const [toIso, setToIso] = useState(() => defaultToIso(data));

  // Facetten-Filter (dieselben Prädikate wie die Epics-Liste, s. epics-list-shell):
  // grenzen die Epic-Menge ein; die Projekt-Auswahl wählt innerhalb davon.
  const [query, setQuery] = useState("");
  const [vsFilter, setVsFilter] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [flag, setFlag] = useState<FlagFilter>("all");
  const [horizon, setHorizon] = useState<string | null>(null);
  const [epicTypeFilter, setEpicTypeFilter] = useState<string | null>(null);
  const facetEpics = useMemo(
    () =>
      data.epics.filter((e) => {
        if (vsFilter && e.valueStreamId !== vsFilter) return false;
        if (ownerFilter && e.ownerId !== ownerFilter) return false;
        if (flag === "steering" && !e.needsSteeringAttention) return false;
        if (flag === "budgeting" && !e.stagedForBudgeting) return false;
        if (horizon != null && e.investmentHorizon !== horizon) return false;
        if (epicTypeFilter != null && e.epicType !== epicTypeFilter) return false;
        return matchesQuery([e.title, e.ownerLabel, e.valueStream], query.trim());
      }),
    [data.epics, vsFilter, ownerFilter, flag, horizon, epicTypeFilter, query],
  );
  // Facetten-Optionen aus den vorhandenen Epics (kein zusätzlicher Server-Load).
  const valueStreamOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of data.epics)
      if (e.valueStreamId && e.valueStream) m.set(e.valueStreamId, e.valueStream);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.epics]);
  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of data.epics) if (e.ownerId) m.set(e.ownerId, e.ownerLabel ?? e.ownerId);
    return [...m]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data.epics]);
  // Serien-Auswahl = Projekt-Auswahl ∩ Facetten-Treffer.
  const effectiveSelected = useMemo(() => {
    const s = new Set<string>();
    for (const e of facetEpics) if (selected.has(e.id)) s.add(e.id);
    return s;
  }, [facetEpics, selected]);

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

  // „heute" einmal je Mount fixieren (stabile Memo-Deps; Monatsauflösung genügt).
  const now = useMemo(() => new Date(), []);
  const series = useMemo(
    () => buildPortfolioSeries(data, { selectedEpicIds: effectiveSelected, fromIso, toIso }, now),
    [data, effectiveSelected, fromIso, toIso, now],
  );
  const todayIndex = series.todayIndex;

  // Darstellung: Standard nach Value Stream gebündelt, umschaltbar auf ART-/Epic-/Status-Sicht.
  const [groupMode, setGroupMode] = useState<GroupMode>("valueStream");
  const vsByEpicId = useMemo(
    () => new Map(data.epics.map((e) => [e.id, e.valueStream] as const)),
    [data.epics],
  );
  // Epic → ART (über die Primär-Solution aufgelöst, serverseitig) für „Nach ART".
  const artByEpicId = useMemo(
    () => new Map(data.epics.map((e) => [e.id, e.art] as const)),
    [data.epics],
  );
  // Stage-Timeline je Epic (ISO → Date) für die zeit-variable „Nach Status"-Gruppierung.
  const stageTimelineById = useMemo(
    () =>
      new Map<string, StageTransition[]>(
        data.epics.map((e) => [
          e.id,
          e.stageTimeline.map((t) => ({ gate: t.gate as StageGate, month: new Date(t.iso) })),
        ]),
      ),
    [data.epics],
  );
  const confirmedMap = useMemo(
    () => new Map(data.epics.map((e) => [e.id, e.hasAllocation] as const)),
    [data.epics],
  );
  const displaySeries = useMemo<PortfolioSeries>(() => {
    if (groupMode === "valueStream")
      return { ...series, perEpic: groupSeriesByValueStream(series.perEpic, vsByEpicId) };
    if (groupMode === "art")
      return {
        ...series,
        perEpic: groupSeriesByValueStream(series.perEpic, artByEpicId, "Ohne ART", "art"),
      };
    if (groupMode === "status")
      return {
        ...series,
        perEpic: groupSeriesByEstimatedStage(
          series.perEpic,
          stageTimelineById,
          series.axis,
          confirmedMap,
        ),
      };
    return series;
  }, [series, groupMode, vsByEpicId, artByEpicId, stageTimelineById, confirmedMap]);
  // Stabile Farbe je Bucket-Titel (Value Stream bzw. ART), damit die freigegeben-
  // und die veranschlagt-Sub-Serie desselben Buckets dieselbe Farbe teilen (solid
  // vs. schraffiert). Nur in den Bucket-Modi (Value Stream / ART) genutzt.
  const vsColorByTitle = useMemo(() => {
    const map: Record<string, string> = {};
    let i = 0;
    for (const e of displaySeries.perEpic) {
      if (!(e.title in map)) map[e.title] = epicColor(i++);
    }
    return map;
  }, [displaySeries]);

  const months = series.axis.months;
  const ticks = months.map((m) => m.label).filter((l) => quarterTick(l) !== "");

  // Benefit-Velocity: pro Gruppe zwei Segmente — gemessen (`benefit`) + Forecast-
  // Rest zum Plan (`benefitUplift`, Schlüssel `${id}#up`).
  const benefitRows = useMemo(
    () =>
      displaySeries.axis.months.map((mo, m) => {
        const row: Row = { label: mo.label };
        displaySeries.perEpic.forEach((e) => {
          row[e.id] = e.benefit[m] ?? 0;
          row[`${e.id}#up`] = e.benefitUplift[m] ?? 0;
        });
        return row;
      }),
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
  // Break-Even: Ist bis heute durchgezogen, Forecast (Zukunft) gestrichelt. Der
  // „heute"-Monat liegt in beiden Segmenten, damit die Linien nahtlos anschließen.
  const breakEvenRows = useMemo(
    () =>
      months.map((mo, m) => {
        const inPast = m <= todayIndex;
        const inFuture = m >= todayIndex;
        const av = series.accBV[m] ?? 0;
        const ac = series.accCost[m] ?? 0;
        const net = series.breakEven[m] ?? 0;
        return {
          label: mo.label,
          accValuePast: inPast ? av : null,
          accValueFuture: inFuture ? av : null,
          accCostPast: inPast ? ac : null,
          accCostFuture: inFuture ? ac : null,
          netPast: inPast ? net : null,
          netFuture: inFuture ? net : null,
        };
      }),
    [series, months, todayIndex],
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

  // Stacks der aktiven Sicht: Bucket-Modi (Value Stream / ART) je Gruppe (Farbe
  // nach Titel, confirmed aus dem `:est`-Suffix), Epic-Modus je Epic (stabile
  // Farbe/Allocation), Status-Modus je Stage-Gate (Rampe L0→L5).
  const bucketMode = groupMode === "valueStream" || groupMode === "art";
  const displayStacks = displaySeries.perEpic.map((e) => {
    if (groupMode === "status") {
      const gate = stageOf(e.title);
      return {
        id: e.id,
        title: STAGE_LABELS[gate],
        color: STAGE_COLORS[gate],
        confirmed: !e.id.endsWith(":est"),
      };
    }
    return {
      id: e.id,
      title: e.title,
      color: bucketMode ? vsColorByTitle[e.title]! : colorById[e.id]!,
      confirmed: bucketMode ? !e.id.endsWith(":est") : (confirmedById[e.id] ?? false),
    };
  });
  const stackedBy =
    groupMode === "valueStream"
      ? "Value Stream"
      : groupMode === "art"
        ? "ART"
        : groupMode === "status"
          ? "Status"
          : "Epic";

  return (
    <div className="space-y-6">
      <HatchDefs stacks={displayStacks} />
      <Slicers
        facetEpics={facetEpics}
        selected={effectiveSelected}
        colorById={colorById}
        onToggle={toggle}
        onAll={() => setSelected(new Set(data.epics.map((e) => e.id)))}
        onNone={() => setSelected(new Set())}
        onToggleMany={(ids, on) =>
          setSelected((prev) => {
            const next = new Set(prev);
            for (const id of ids) if (on) next.add(id);
            if (!on) for (const id of ids) next.delete(id);
            return next;
          })
        }
        fromIso={fromIso}
        toIso={toIso}
        onFrom={setFromIso}
        onTo={setToIso}
        groupMode={groupMode}
        onGroupMode={setGroupMode}
        facets={{
          query,
          valueStreamId: vsFilter,
          ownerId: ownerFilter,
          flag,
          horizon,
          epicType: epicTypeFilter,
          valueStreamOptions,
          ownerOptions,
          onQueryChange: setQuery,
          onValueStreamChange: setVsFilter,
          onOwnerChange: setOwnerFilter,
          onFlagChange: setFlag,
          onHorizonChange: setHorizon,
          onEpicTypeChange: setEpicTypeFilter,
        }}
      />

      {/* Benefit-Wasserfall (Wert je Status vs. Zielwert) — erster Inhalts-Abschnitt.
          Folgt Facetten + Projekt-Auswahl, sobald eingegrenzt; „Alle" = null (alle
          ziel-verknüpften Epics zählen, auch solche ohne Business-Case-Economics). */}
      <GoalBenefitWaterfallSection
        data={goalWaterfalls}
        selectedEpicIds={effectiveSelected.size === data.epics.length ? null : effectiveSelected}
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
          <StackedChart
            rows={benefitRows}
            stacks={displayStacks}
            ticks={ticks}
            months={months}
            todayIndex={todayIndex}
            uplift
          >
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
          <StackedChart
            rows={costRows}
            stacks={displayStacks}
            ticks={ticks}
            months={months}
            todayIndex={todayIndex}
            hatchUnconfirmed
          />
        </Panel>

        <Panel title="ROI" subtitle="Business Value (grün) vs. Kosten (rot) je Monat">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={roiRows} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis {...xAxis(ticks)} />
              <YAxis {...yAxis} />
              <Tooltip {...tooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <TodayLine months={months} todayIndex={todayIndex} />
              <Bar dataKey="value" name="Business Value" fill={VALUE_COLOR} maxBarSize={10}>
                {roiRows.map((_, m) => (
                  <Cell
                    key={m}
                    fill={VALUE_COLOR}
                    fillOpacity={m > todayIndex ? FORECAST_OPACITY : 1}
                  />
                ))}
              </Bar>
              <Bar dataKey="cost" name="Kosten" fill={COST_COLOR} maxBarSize={10}>
                {roiRows.map((_, m) => (
                  <Cell
                    key={m}
                    fill={COST_COLOR}
                    fillOpacity={m > todayIndex ? FORECAST_OPACITY : 1}
                  />
                ))}
              </Bar>
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
              <TodayLine months={months} todayIndex={todayIndex} />
              <Line
                type="monotone"
                dataKey="accValuePast"
                name="Σ Business Value"
                stroke={VALUE_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="accValueFuture"
                stroke={VALUE_COLOR}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="accCostPast"
                name="Σ Kosten"
                stroke={COST_COLOR}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="accCostFuture"
                stroke={COST_COLOR}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="netPast"
                name="Break Even"
                stroke={BREAKEVEN_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="netFuture"
                stroke={BREAKEVEN_COLOR}
                strokeWidth={2}
                strokeDasharray="2 3"
                strokeOpacity={0.7}
                dot={false}
                connectNulls
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Gained Value Analyse" subtitle="Kumulierter Business Value">
          <StackedChart
            rows={accValueRows}
            stacks={displayStacks}
            ticks={ticks}
            months={months}
            todayIndex={todayIndex}
          />
        </Panel>

        <Panel title="Cost Analysis" subtitle="Kumulierte Kosten">
          <StackedChart
            rows={accCostRows}
            stacks={displayStacks}
            ticks={ticks}
            months={months}
            todayIndex={todayIndex}
            hatchUnconfirmed
          />
        </Panel>

        <Panel
          title="Positiver und Negativer Cash-Flow"
          subtitle={`Laufender kumulierter Saldo je ${stackedBy} — negative unterhalb, positive oberhalb der 0-Linie`}
          className="xl:col-span-2"
        >
          <CashFlowChart
            series={displaySeries}
            stacks={displayStacks}
            ticks={ticks}
            months={months}
            todayIndex={todayIndex}
          />
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

/**
 * Chart-Legende der beiden orthogonalen Konfidenz-Achsen: Funding (freigegeben
 * vs. veranschlagt — nur `hatch`-Charts) und Zeit (Ist vs. Forecast/Zukunft —
 * `forecast`, reduzierte Deckkraft rechts der „heute"-Linie).
 */
function ChartLegend({ hatch = false, forecast = false }: { hatch?: boolean; forecast?: boolean }) {
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

function StackedChart({
  rows,
  stacks,
  ticks,
  months,
  todayIndex,
  height = 300,
  hatchUnconfirmed = false,
  uplift = false,
  children,
}: {
  rows: Row[];
  stacks: Stack[];
  ticks: string[];
  months: PortfolioSeries["axis"]["months"];
  /** Ist/Forecast-Grenze: Monate mit Index > todayIndex = Zukunft (transparent). */
  todayIndex: number;
  height?: number;
  /** Draw Epics without a budgeting allocation with a hatched fill (cost charts). */
  hatchUnconfirmed?: boolean;
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
          <Tooltip {...tooltip} />
          <TodayLine months={months} todayIndex={todayIndex} />
          {children}
          {stacks.map((s) => {
            const estimated = hatchUnconfirmed && !s.confirmed;
            const fill = estimated ? `url(#hatch-${s.id})` : s.color;
            return (
              <Bar
                key={s.id}
                dataKey={s.id}
                name={estimated ? `${s.title} (veranschlagt)` : s.title}
                stackId="a"
                fill={fill}
                maxBarSize={14}
              >
                {rows.map((_, m) => (
                  <Cell key={m} fill={fill} fillOpacity={m > todayIndex ? FORECAST_OPACITY : 1} />
                ))}
              </Bar>
            );
          })}
          {uplift &&
            stacks.map((s) => (
              <Bar
                key={`${s.id}#up`}
                dataKey={`${s.id}#up`}
                name={`${s.title} · Forecast`}
                stackId="a"
                fill={s.color}
                fillOpacity={FORECAST_OPACITY}
                maxBarSize={14}
                legendType="none"
              />
            ))}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend hatch={hatchUnconfirmed} forecast />
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
  months,
  todayIndex,
}: {
  series: PortfolioSeries;
  stacks: Stack[];
  ticks: string[];
  months: PortfolioSeries["axis"]["months"];
  todayIndex: number;
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
          <TodayLine months={months} todayIndex={todayIndex} />
          {stacks.flatMap((s) => {
            const fill = s.confirmed ? s.color : `url(#hatch-${s.id})`;
            const cells = (suffix: string) =>
              rows.map((_, m) => (
                <Cell
                  key={`${suffix}-${m}`}
                  fill={fill}
                  fillOpacity={m > todayIndex ? FORECAST_OPACITY : 1}
                />
              ));
            return [
              <Bar
                key={`${s.id}#pos`}
                dataKey={`${s.id}#pos`}
                stackId="cashflow"
                fill={fill}
                maxBarSize={14}
              >
                {cells("pos")}
              </Bar>,
              <Bar
                key={`${s.id}#neg`}
                dataKey={`${s.id}#neg`}
                stackId="cashflow"
                fill={fill}
                maxBarSize={14}
              >
                {cells("neg")}
              </Bar>,
            ];
          })}
        </BarChart>
      </ResponsiveContainer>
      <ChartLegend hatch forecast />
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

interface SlicerFacetProps {
  query: string;
  valueStreamId: string | null;
  ownerId: string | null;
  flag: FlagFilter;
  horizon: string | null;
  epicType: string | null;
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  onQueryChange: (next: string) => void;
  onValueStreamChange: (next: string | null) => void;
  onOwnerChange: (next: string | null) => void;
  onFlagChange: (next: FlagFilter) => void;
  onHorizonChange: (next: string | null) => void;
  onEpicTypeChange: (next: string | null) => void;
}

function Slicers({
  facetEpics,
  selected,
  colorById,
  onToggle,
  onAll,
  onNone,
  onToggleMany,
  fromIso,
  toIso,
  onFrom,
  onTo,
  groupMode,
  onGroupMode,
  facets,
}: {
  /** Die Epics, die die Facetten-Filter passieren — Optionsmenge des Projekt-Dropdowns. */
  facetEpics: PortfolioEconomicsData["epics"];
  /** Aktive Auswahl innerhalb der Facetten-Treffer. */
  selected: Set<string>;
  colorById: Record<string, string>;
  onToggle: (id: string) => void;
  onAll: () => void;
  onNone: () => void;
  onToggleMany: (ids: string[], on: boolean) => void;
  fromIso: string;
  toIso: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  groupMode: GroupMode;
  onGroupMode: (m: GroupMode) => void;
  facets: SlicerFacetProps;
}) {
  return (
    <Card className="space-y-4 p-4">
      <EpicFacetFilterBar {...facets} />

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-sm font-medium">Projekte</h2>
            <button onClick={onAll} className="text-xs text-primary hover:underline">
              Alle
            </button>
            <button onClick={onNone} className="text-xs text-primary hover:underline">
              Keine
            </button>
          </div>
          <MultiSelectFilter
            label="Projekte"
            searchable
            sections={[
              {
                heading: "Sichtbare Projekte",
                options: facetEpics.map((e) => ({
                  value: e.id,
                  label: e.title,
                  ...(colorById[e.id] ? { color: colorById[e.id] } : {}),
                })),
              },
            ]}
            selected={selected}
            onToggle={onToggle}
            onToggleSection={onToggleMany}
            onClear={onNone}
            disabled={facetEpics.length === 0}
          />
          {facetEpics.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine Epics für die aktuellen Filter.</p>
          )}
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
                ["art", "Nach ART"],
                ["epic", "Nach Epic"],
                ["status", "Nach Status"],
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
