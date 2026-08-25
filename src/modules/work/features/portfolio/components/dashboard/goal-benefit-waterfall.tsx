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
  type GoalWaterfallData,
  type GoalWaterfallGoal,
  type WaterfallStep,
} from "@/modules/work/domain/goal-benefit-waterfall";
import { formatMetricValue } from "@/modules/core/goals/domain/goal-metric";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";

/** Deckkraft der Estimate/Forecast-Anteile (Zeit-/Reifegrad-Konfidenz). */
const FORECAST_OPACITY = 0.4;
const GAP_COLOR = "#dc2626";
const TOTAL_COLOR = "#64748b";

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
  base: number;
  solid: number;
  forecast: number;
  kind: WaterfallStep["kind"];
  gate: StageGate | null;
}

function toRows(steps: WaterfallStep[]): WfRow[] {
  return steps.map((s) => ({
    label: s.kind === "total" ? "Σ heute" : s.kind === "gap" ? "Lücke" : s.gate!,
    sublabel: s.kind === "stage" ? STAGE_SUBLABEL[s.gate!] : "",
    base: s.base,
    solid: s.solid,
    forecast: s.forecast,
    kind: s.kind,
    gate: s.gate,
  }));
}

function solidColor(r: WfRow): string {
  if (r.kind === "total") return TOTAL_COLOR;
  if (r.kind === "gap") return "transparent";
  return STAGE_COLORS[r.gate!];
}
function forecastColor(r: WfRow): string {
  if (r.kind === "gap") return GAP_COLOR;
  if (r.kind === "total") return "transparent";
  return STAGE_COLORS[r.gate!];
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
  const wf = useMemo(
    () => buildGoalWaterfall(goal, data.epicsByGoal[goal.id] ?? [], selectedEpicIds),
    [goal, data.epicsByGoal, selectedEpicIds],
  );
  // kompakter Fortschrittsbalken: Ist (solid) + Estimate/Rest (forecast) gegen Ziel.
  const solidSum = wf.steps.filter((s) => s.kind === "stage").reduce((a, s) => a + s.solid, 0);
  const forecastSum = wf.steps
    .filter((s) => s.kind === "stage")
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
}: {
  data: GoalWaterfallData;
  /** Aktiver Projekt-ID-Filter (null = alle). */
  selectedEpicIds: ReadonlySet<string> | null;
}) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => data.goals[0]?.id ?? "");

  const goal = useMemo(
    () => data.goals.find((g) => g.id === selectedGoalId) ?? data.goals[0],
    [data.goals, selectedGoalId],
  );

  const rows = useMemo(() => {
    if (!goal) return [];
    const wf = buildGoalWaterfall(goal, data.epicsByGoal[goal.id] ?? [], selectedEpicIds);
    return toRows(wf.steps);
  }, [goal, data.epicsByGoal, selectedEpicIds]);

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
            Wert je Status &amp; Lücke zum Ziel — Bezug: heute
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
            {data.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} · Ziel {fmtCompact(g.target, g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {goal && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
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

      {/* Small Multiples: alle messbaren Ziele */}
      {data.goals.length > 1 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Alle Ziele
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.goals.map((g) => (
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
