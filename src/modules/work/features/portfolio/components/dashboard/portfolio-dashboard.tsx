"use client";

import { useMemo, useState, useActionState } from "react";
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
import { GoalBenefitWaterfallSection, type WaterfallEpicInfo } from "./goal-benefit-waterfall";
import type { GoalWaterfallData } from "@/modules/work/domain/goal-benefit-waterfall";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StackTooltip, type Stack, type StackPayloadItem } from "@/components/charts/stack-tooltip";
import {
  ChartLegend,
  FORECAST_OPACITY,
  fillOf,
  HatchDefs,
  Panel,
  StackedChart,
  TodayLine,
  quarterTick,
  tooltip,
  xAxis,
  yAxis,
  type Row,
} from "@/components/charts/stacked-chart";

interface Props {
  data: PortfolioEconomicsData;
  canEdit: boolean;
  goalWaterfalls: GoalWaterfallData;
}

type GroupMode = "valueStream" | "art" | "epic" | "status";

/** Sentinel der ART-Facette für Epics ohne Primär-Solution-ART. */
const OHNE_ART = "Ohne ART";

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
  const [artFilter, setArtFilter] = useState<string | null>(null);
  const facetEpics = useMemo(
    () =>
      data.epics.filter((e) => {
        if (vsFilter && e.valueStreamId !== vsFilter) return false;
        if (ownerFilter && e.ownerId !== ownerFilter) return false;
        if (flag === "steering" && !e.needsSteeringAttention) return false;
        if (flag === "budgeting" && !e.stagedForBudgeting) return false;
        if (horizon != null && e.investmentHorizon !== horizon) return false;
        if (epicTypeFilter != null && e.epicType !== epicTypeFilter) return false;
        if (artFilter != null && (artFilter === OHNE_ART ? e.art != null : e.art !== artFilter))
          return false;
        return matchesQuery([e.title, e.ownerLabel, e.valueStream], query.trim());
      }),
    [data.epics, vsFilter, ownerFilter, flag, horizon, epicTypeFilter, artFilter, query],
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
  // ART-Facette: distinct ART-Namen + „Ohne ART" (Epics ohne Primär-Solution-ART).
  const artOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNull = false;
    for (const e of data.epics) {
      if (e.art) names.add(e.art);
      else hasNull = true;
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    return hasNull ? [...sorted, OHNE_ART] : sorted;
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
  // Dimension-Fakten je Epic für den Benefit-Wasserfall (VS/ART/Titel/Farbe).
  const epicInfoById = useMemo(() => {
    const map: Record<string, WaterfallEpicInfo> = {};
    data.epics.forEach((e) => {
      map[e.id] = {
        valueStream: e.valueStream,
        art: e.art,
        title: e.title,
        color: colorById[e.id] ?? epicColor(0),
      };
    });
    return map;
  }, [data.epics, colorById]);
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
          art: artFilter,
          valueStreamOptions,
          ownerOptions,
          artOptions,
          onQueryChange: setQuery,
          onValueStreamChange: setVsFilter,
          onOwnerChange: setOwnerFilter,
          onFlagChange: setFlag,
          onHorizonChange: setHorizon,
          onEpicTypeChange: setEpicTypeFilter,
          onArtChange: setArtFilter,
        }}
      />

      {/* Benefit-Wasserfall (Wert je Ansicht-Spalte vs. Zielwert) — folgt Facetten,
          Projekt-Auswahl und dem Ansicht-Umschalter; „Alle" = null (alle ziel-
          verknüpften Epics zählen, auch solche ohne Business-Case-Economics). */}
      <GoalBenefitWaterfallSection
        data={goalWaterfalls}
        selectedEpicIds={effectiveSelected.size === data.epics.length ? null : effectiveSelected}
        groupMode={groupMode}
        epicInfoById={epicInfoById}
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
              <StackTooltip
                active={active}
                payload={payload as unknown as readonly StackPayloadItem[] | undefined}
                label={typeof label === "string" ? label : ""}
                stacks={stacks}
              />
            )}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <TodayLine months={months} todayIndex={todayIndex} />
          {stacks.flatMap((s) => {
            const fill = fillOf(s);
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

// --- slicers ---------------------------------------------------------------

interface SlicerFacetProps {
  query: string;
  valueStreamId: string | null;
  ownerId: string | null;
  flag: FlagFilter;
  horizon: string | null;
  epicType: string | null;
  art: string | null;
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  artOptions: string[];
  onQueryChange: (next: string) => void;
  onValueStreamChange: (next: string | null) => void;
  onOwnerChange: (next: string | null) => void;
  onFlagChange: (next: FlagFilter) => void;
  onHorizonChange: (next: string | null) => void;
  onEpicTypeChange: (next: string | null) => void;
  onArtChange: (next: string | null) => void;
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
