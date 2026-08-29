"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  buildGoalWaterfall,
  maturityBand,
  STAGE_ORDER,
  type GoalWaterfallData,
  type GoalWaterfallEpic,
  type GoalWaterfallGoal,
  type WaterfallDimension,
  type WaterfallStep,
} from "@/modules/work/domain/goal-benefit-waterfall";
import { formatMetricValue } from "@/modules/core/goals/domain/goal-metric";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { epicColor } from "./epic-colors";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";

/** Deckkraft der Estimate/Forecast-Anteile (Zeit-/Reifegrad-Konfidenz). */
const FORECAST_OPACITY = 0.4;
const GAP_COLOR = "#dc2626";
const TOTAL_COLOR = "#64748b";
const NEUTRAL_COLOR = "#94a3b8";

/** Gate → Farbe (Rampe L0 grau → L5 grün), konsistent mit dem Status-Modus. */
const STAGE_COLORS: Record<StageGate, string> = {
  L0: "#94a3b8",
  L1: "#60a5fa",
  L2: "#38bdf8",
  L3: "#818cf8",
  L4: "#f59e0b",
  L5: "#22c55e",
};
const STAGE_SUBLABEL: Record<StageGate, string> = {
  L0: "Funnel",
  L1: "Detailing",
  L2: "Analyse",
  L3: "Backlog",
  L4: "Umsetzung",
  L5: "Impact",
};

// ── Bucket-Dimension aus dem Ansicht-Umschalter des Dashboards ──────────────

/** Die Ansicht des Dashboards, der der Wasserfall folgt. */
export type WaterfallGroupMode = "valueStream" | "art" | "epic" | "status";

/** Dimension-Fakten je Epic — vom Dashboard aus `data.epics` gebaut. */
export interface WaterfallEpicInfo {
  valueStream: string | null;
  art: string | null;
  title: string;
  color: string;
}

const GROUP_LABEL: Record<WaterfallGroupMode, string> = {
  status: "Status",
  valueStream: "Wertstrom",
  art: "ART",
  epic: "Epic",
};

const NULL_BUCKET_KEY = "__none__";
const OTHERS_BUCKET_KEY = "__others__";
/** Epic-Modus: die N größten Beiträge als eigene Spalten, Rest = „Weitere". */
const TOP_EPIC_BUCKETS = 15;

/** Gesamt-Beitrag eines Epics in Ziel-Einheit (solid + forecast, bandabhängig). */
function epicContribution(e: GoalWaterfallEpic): number {
  const band = maturityBand(e.gate, e.subStage);
  if (band === "estimate") return e.planned;
  if (band === "actual") return e.realized;
  return e.realized + Math.max(e.planned - e.realized, 0);
}

/**
 * Baut die Wasserfall-Dimension für ein Ziel: Status = feste L0–L5-Spalten;
 * Wertstrom/ART = distinct Namen der beitragenden (gefilterten) Epics, „Ohne …"
 * zuletzt; Epic = Top-15 nach Beitrag + Sammelspalte „Weitere".
 */
function buildDimension(
  mode: WaterfallGroupMode,
  epics: readonly GoalWaterfallEpic[],
  selectedEpicIds: ReadonlySet<string> | null,
  epicInfoById: Record<string, WaterfallEpicInfo>,
): WaterfallDimension {
  if (mode === "status") {
    return {
      buckets: STAGE_ORDER.map((gate) => ({
        key: gate,
        label: gate,
        sublabel: STAGE_SUBLABEL[gate],
        color: STAGE_COLORS[gate],
      })),
      keyOf: (e) => e.gate,
    };
  }
  const active = selectedEpicIds ? epics.filter((e) => selectedEpicIds.has(e.epicId)) : epics;

  if (mode === "valueStream" || mode === "art") {
    const nameOf = (epicId: string): string | null =>
      (mode === "valueStream" ? epicInfoById[epicId]?.valueStream : epicInfoById[epicId]?.art) ??
      null;
    const names = new Set<string>();
    let hasUnassigned = false;
    for (const e of active) {
      const n = nameOf(e.epicId);
      if (n) names.add(n);
      else hasUnassigned = true;
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "de"));
    const buckets = sorted.map((n, i) => ({ key: `n:${n}`, label: n, color: epicColor(i) }));
    if (hasUnassigned || buckets.length === 0) {
      buckets.push({
        key: NULL_BUCKET_KEY,
        label: mode === "valueStream" ? "Ohne Wertstrom" : "Ohne ART",
        color: NEUTRAL_COLOR,
      });
    }
    return {
      buckets,
      keyOf: (e) => {
        const n = nameOf(e.epicId);
        return n ? `n:${n}` : NULL_BUCKET_KEY;
      },
    };
  }

  // mode === "epic": Beitrag je Epic summieren, Top-N als Spalten, Rest gebündelt.
  const contrib = new Map<string, number>();
  for (const e of active) {
    contrib.set(e.epicId, (contrib.get(e.epicId) ?? 0) + epicContribution(e));
  }
  const top = [...contrib.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_EPIC_BUCKETS)
    .map(([id]) => id);
  const topSet = new Set(top);
  const buckets = top.map((id) => ({
    key: id,
    label: epicInfoById[id]?.title ?? `Epic ${id.slice(0, 8)}`,
    color: epicInfoById[id]?.color ?? NEUTRAL_COLOR,
  }));
  if (contrib.size > top.length || buckets.length === 0) {
    buckets.push({ key: OTHERS_BUCKET_KEY, label: "Weitere", color: NEUTRAL_COLOR });
  }
  return {
    buckets,
    keyOf: (e) => (topSet.has(e.epicId) ? e.epicId : OTHERS_BUCKET_KEY),
  };
}

type MetricSpec = Pick<GoalWaterfallGoal, "metricType" | "precision" | "currencyCode">;

/** Kompaktes Achsen-Label (k/Mio für große Beträge), Einheit über den Metrik-Typ. */
function fmtCompact(v: number, goal: MetricSpec): string {
  const abs = Math.abs(v);
  if (goal.metricType === "currency") {
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} Mio`;
    if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  }
  return formatMetricValue(v, goal);
}

interface WfRow {
  label: string;
  sublabel: string;
  color: string;
  base: number;
  solid: number;
  forecast: number;
  kind: WaterfallStep["kind"];
}

function toRows(steps: WaterfallStep[]): WfRow[] {
  return steps.map((s) => ({
    label: s.kind === "total" ? "Σ heute" : s.kind === "gap" ? "Lücke" : s.label,
    sublabel: s.sublabel,
    color: s.color ?? NEUTRAL_COLOR,
    base: s.base,
    solid: s.solid,
    forecast: s.forecast,
    kind: s.kind,
  }));
}

function solidColor(r: WfRow): string {
  if (r.kind === "total") return TOTAL_COLOR;
  if (r.kind === "gap") return "transparent";
  return r.color;
}
function forecastColor(r: WfRow): string {
  if (r.kind === "gap") return GAP_COLOR;
  if (r.kind === "total") return "transparent";
  return r.color;
}

/** Lange Bucket-Namen (Wertströme/Epics) auf Achsen-taugliche Länge kürzen. */
function truncateTick(v: string): string {
  return v.length > 14 ? `${v.slice(0, 13)}…` : v;
}

// ── großes Chart ────────────────────────────────────────────────────────────

function WaterfallChart({
  goal,
  rows,
  height = 380,
}: {
  goal: GoalWaterfallGoal;
  rows: WfRow[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 12, right: 12, left: 8, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          tickFormatter={truncateTick}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          height={40}
        />
        <YAxis
          tickFormatter={(v: number) => fmtCompact(v, goal)}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const r = payload[0]!.payload as WfRow;
            const rowsOut: Array<[string, number]> = [];
            if (r.kind === "gap") rowsOut.push(["Fehlt zum Ziel", r.forecast]);
            else if (r.kind === "total") rowsOut.push(["Σ heute", r.solid]);
            else {
              if (r.solid) rowsOut.push(["Ist / realisiert", r.solid]);
              if (r.forecast) rowsOut.push(["Estimate / Rest", r.forecast]);
              if (!r.solid && !r.forecast) rowsOut.push(["—", 0]);
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
                <p className="mb-1 font-medium">
                  {r.label}
                  {r.sublabel ? ` · ${r.sublabel}` : ""}
                </p>
                {rowsOut.map(([k, v]) => (
                  <div key={k}>
                    {k}: {formatMetricValue(v, goal)}
                  </div>
                ))}
              </div>
            );
          }}
        />
        <ReferenceLine
          y={goal.target}
          stroke="var(--foreground)"
          strokeWidth={2}
          strokeDasharray="7 5"
          ifOverflow="extendDomain"
          label={{
            value: `Ziel: ${formatMetricValue(goal.target, goal)}`,
            position: "insideTopRight",
            fontSize: 11,
            fontWeight: 600,
            fill: "var(--foreground)",
          }}
        />
        {/* schwebender Sockel */}
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        {/* Ist / Actual */}
        <Bar dataKey="solid" stackId="wf" maxBarSize={56} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell
              key={i}
              fill={solidColor(r)}
              stroke={r.kind === "total" ? "var(--foreground)" : "none"}
              strokeWidth={r.kind === "total" ? 1.5 : 0}
              fillOpacity={r.kind === "total" ? 0.15 : 1}
            />
          ))}
        </Bar>
        {/* Estimate / Rest / Lücke */}
        <Bar dataKey="forecast" stackId="wf" maxBarSize={56} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell
              key={i}
              fill={forecastColor(r)}
              fillOpacity={r.kind === "gap" ? 0.55 : FORECAST_OPACITY}
              stroke={r.kind === "gap" ? GAP_COLOR : "none"}
              strokeWidth={r.kind === "gap" ? 1 : 0}
              strokeDasharray={r.kind === "gap" ? "3 2" : undefined}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Mini-Wasserfall (Small Multiple) ─────────────────────────────────────────

function MiniWaterfall({
  goal,
  data,
  selectedEpicIds,
  active,
  onSelect,
}: {
  goal: GoalWaterfallGoal;
  data: GoalWaterfallData;
  selectedEpicIds: ReadonlySet<string> | null;
  active: boolean;
  onSelect: () => void;
}) {
  // Die Dimension ist für die Summen egal — der Mini-Balken nutzt den Default.
  const wf = useMemo(
    () => buildGoalWaterfall(goal, data.epicsByGoal[goal.id] ?? [], selectedEpicIds),
    [goal, data.epicsByGoal, selectedEpicIds],
  );
  // kompakter Fortschrittsbalken: Ist (solid) + Estimate/Rest (forecast) gegen Ziel.
  const solidSum = wf.steps.filter((s) => s.kind === "bucket").reduce((a, s) => a + s.solid, 0);
  const forecastSum = wf.steps
    .filter((s) => s.kind === "bucket")
    .reduce((a, s) => a + s.forecast, 0);
  const denom = Math.max(goal.target, wf.total, 1);
  const pctSolid = (solidSum / denom) * 100;
  const pctForecast = (forecastSum / denom) * 100;
  const pctTarget = (goal.target / denom) * 100;
  const attainment = goal.target > 0 ? Math.round((wf.total / goal.target) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
        active ? "border-primary bg-muted/50" : "hover:bg-muted/30"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium" title={goal.title}>
          {goal.title}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {attainment}%
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 flex">
          <div style={{ width: `${pctSolid}%`, background: "var(--foreground)" }} />
          <div
            style={{
              width: `${pctForecast}%`,
              background: "var(--foreground)",
              opacity: FORECAST_OPACITY,
            }}
          />
        </div>
        {/* Ziel-Marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `calc(${Math.min(pctTarget, 100)}% - 1px)` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">{formatMetricValue(wf.total, goal)}</span>
        <span className="tabular-nums">Ziel {fmtCompact(goal.target, goal)}</span>
      </div>
    </button>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export function GoalBenefitWaterfallSection({
  data,
  selectedEpicIds,
  groupMode,
  epicInfoById,
}: {
  data: GoalWaterfallData;
  /** Aktiver Projekt-ID-Filter (null = alle). */
  selectedEpicIds: ReadonlySet<string> | null;
  /** Die Ansicht des Dashboards — bestimmt die Wasserfall-Spalten. */
  groupMode: WaterfallGroupMode;
  /** Dimension-Fakten je Epic (VS/ART/Titel/Farbe), aus `data.epics` gebaut. */
  epicInfoById: Record<string, WaterfallEpicInfo>;
}) {
  // Wurzel-Ziele zuerst; Unterziele hängen im Selektor eingerückt darunter.
  const rootGoals = useMemo(() => data.goals.filter((g) => g.parentId === null), [data.goals]);
  const goalOptions = useMemo(() => {
    const known = new Set(data.goals.map((g) => g.id));
    const out: { goal: GoalWaterfallGoal; depth: number }[] = [];
    for (const root of rootGoals) {
      out.push({ goal: root, depth: 0 });
      for (const child of data.goals.filter((g) => g.parentId === root.id)) {
        out.push({ goal: child, depth: 1 });
      }
    }
    // Unterziele, deren Eltern selbst keinen Zielwert haben, flach anhängen.
    for (const g of data.goals) {
      if (g.parentId !== null && !known.has(g.parentId)) out.push({ goal: g, depth: 1 });
    }
    return out;
  }, [data.goals, rootGoals]);

  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    () => rootGoals[0]?.id ?? data.goals[0]?.id ?? "",
  );

  const goal = useMemo(
    () => data.goals.find((g) => g.id === selectedGoalId) ?? rootGoals[0] ?? data.goals[0],
    [data.goals, rootGoals, selectedGoalId],
  );

  const rows = useMemo(() => {
    if (!goal) return [];
    const epics = data.epicsByGoal[goal.id] ?? [];
    const dimension = buildDimension(groupMode, epics, selectedEpicIds, epicInfoById);
    const wf = buildGoalWaterfall(goal, epics, selectedEpicIds, dimension);
    return toRows(wf.steps);
  }, [goal, data.epicsByGoal, selectedEpicIds, groupMode, epicInfoById]);

  if (data.goals.length === 0) {
    return (
      <Card className="p-4">
        <div className="mb-3">
          <h2 className="font-heading text-sm font-medium">Benefit-Wasserfall</h2>
          <p className="text-xs text-muted-foreground">Wert je Status &amp; Lücke zum Ziel</p>
        </div>
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Noch keine messbaren Ziele mit Zielwert. Lege in den{" "}
          <Link href={"/ziele" as never} className="text-primary hover:underline">
            Zielen
          </Link>{" "}
          ein Ziel mit Zielwert an und verknüpfe Epics.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-medium">Benefit-Wasserfall</h2>
          <p className="text-xs text-muted-foreground">
            Wert je {GROUP_LABEL[groupMode]} &amp; Lücke zum Ziel — Bezug: heute
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="wf-goal" className="text-xs text-muted-foreground">
            Ziel
          </label>
          <select
            id="wf-goal"
            value={goal?.id ?? ""}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs"
          >
            {goalOptions.map(({ goal: g, depth }) => (
              <option key={g.id} value={g.id}>
                {depth > 0 ? "  ↳ " : ""}
                {g.title} · Ziel {fmtCompact(g.target, g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {goal && (
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(640, rows.length * 90)}px` }}>
            <WaterfallChart goal={goal} rows={rows} />
          </div>
        </div>
      )}

      {/* Legende */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--foreground)" }}
          />
          Ist / realisiert
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--foreground)", opacity: FORECAST_OPACITY }}
          />
          Estimate / Forecast (Rest zum Ziel)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: GAP_COLOR, opacity: 0.55 }}
          />
          Deckungslücke
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-foreground" />
          Zielwert
        </span>
      </div>

      {/* Small Multiples: die Wurzel-Ziele (Unterziele nur im Selektor, sonst Dopplung) */}
      {rootGoals.length > 1 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Alle Ziele
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rootGoals.map((g) => (
              <MiniWaterfall
                key={g.id}
                goal={g}
                data={data}
                selectedEpicIds={selectedEpicIds}
                active={g.id === goal?.id}
                onSelect={() => setSelectedGoalId(g.id)}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
