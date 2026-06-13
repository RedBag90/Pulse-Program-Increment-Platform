"use client";

import { type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HORIZONS, HORIZON_LABEL, type Horizon } from "@/domain/portfolio-guardrails";
import { STAGE_GATES } from "@/domain/stage-gate";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import type { StageGate } from "@/domain/types";
import {
  isOverWip,
  wipCountLabel,
  PORTFOLIO_WIP_LIMITS,
} from "@/features/portfolio/overview/wip-limits";
import {
  HORIZON_COLUMNS,
  type PortfolioGuardrailsModel,
  type CapacityBucket,
  type MixRow,
  type StageTowerEpic,
  type HorizonColumn,
} from "@/server/views/portfolio-guardrails-view";

interface Props {
  model: PortfolioGuardrailsModel;
}

const STATUS_LABEL: Record<PortfolioGuardrailsModel["horizon"]["status"], string> = {
  green: "Im Soll",
  amber: "Beobachten",
  red: "Drift",
  unknown: "Keine Daten",
};
const STATUS_CLASS: Record<PortfolioGuardrailsModel["horizon"]["status"], string> = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  unknown: "bg-muted text-muted-foreground",
};
const BUCKET_LABEL: Record<CapacityBucket, string> = {
  business: "Business (Solution + Epic)",
  enabler: "Enabler",
};
const HORIZON_COLOR: Record<string, string> = {
  h1: "bg-blue-600",
  h2: "bg-violet-600",
  h3: "bg-fuchsia-600",
};
const BUCKET_COLOR: Record<CapacityBucket, string> = {
  business: "bg-emerald-600",
  enabler: "bg-amber-600",
};

const pct = (v: number) => `${(v * 100).toFixed(0)} %`;
const ppDelta = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)} pp`;

/** Wieviele Quadrate nebeneinander pro Tower-Reihe. 4 hat sich bewaehrt —
 *  haelt die Tower bei vielen Epics kompakt, ohne den Stack-Charakter zu
 *  verlieren. */
const EPICS_PER_ROW = 4;

/** Chunked-Render: epics werden in Reihen `a` 4 gebrochen und in
 *  flex-col-reverse gestapelt, damit der erste Epic links unten landet
 *  und neue Reihen nach oben wachsen.
 *
 *  Spalten-Well: vertikaler Gradient + group-hover-state. Die
 *  renderSquare-Funktion bekommt einen running index (`globalIdx`)
 *  fuer die stagger-fade-in-animation. */
function EpicSquaresGrid({
  epics,
  renderSquare,
}: {
  epics: StageTowerEpic[];
  renderSquare: (e: StageTowerEpic, globalIdx: number) => ReactNode;
}) {
  const rows: StageTowerEpic[][] = [];
  for (let i = 0; i < epics.length; i += EPICS_PER_ROW) {
    rows.push(epics.slice(i, i + EPICS_PER_ROW));
  }
  return (
    <div
      className={
        "flex h-32 w-full flex-col-reverse items-center justify-start gap-0.5 rounded-lg p-1 leading-none " +
        "bg-gradient-to-b from-muted/20 via-muted/30 to-muted/50 " +
        "ring-1 ring-transparent transition-all group-hover:ring-border " +
        "group-hover:from-muted/30 group-hover:to-muted/60"
      }
    >
      {rows.map((row, i) => (
        <div key={i} className="flex flex-row gap-0.5 leading-none">
          {row.map((e, k) => renderSquare(e, i * EPICS_PER_ROW + k))}
        </div>
      ))}
    </div>
  );
}

// Explizite rounded-[3px] statt rounded-md: das design-token --radius-md
// liegt bei ~6.4px und macht 14px-quadrate visuell zu kreisen. 3px corner-
// radius haelt die rechteck-form klar erkennbar.
const SQUARE_BASE =
  "inline-block size-3.5 shrink-0 rounded-[3px] shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] " +
  "transition-transform duration-150 hover:scale-110 hover:ring-2 hover:ring-offset-1 hover:ring-current " +
  "animate-in fade-in zoom-in-50";

/** Steering-Attention-Quadrat — kleines rotes Warning-Triangle oben
 *  rechts vom Quadrat. Deutlich sichtbarer als ein 1px-Ring. */
function EpicSquare({
  colorClass,
  steering,
  delayMs,
  tooltip,
}: {
  colorClass: string;
  steering: boolean;
  delayMs: number;
  tooltip: string;
}) {
  return (
    <span className="relative inline-block" title={tooltip}>
      <span
        className={`${SQUARE_BASE} ${colorClass}`}
        style={{ animationDelay: `${delayMs}ms`, animationDuration: "300ms" }}
      />
      {steering && (
        <AlertTriangle
          className="pointer-events-none absolute -right-1 -top-1 size-2.5 fill-red-100 text-red-600 drop-shadow-sm"
          aria-label="Benötigt Steering-Attention"
        />
      )}
    </span>
  );
}

/**
 * Zwei Guardrail-Cards (Investment by Horizon, Capacity Allocation) am
 * Portfolio-Dashboard. Read-only — die Targets-Pflege lebt unter
 * Setup & Controlling (siehe `GuardrailTargetsForm`).
 */
export function PortfolioGuardrailsSection({ model }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <HorizonCard model={model.horizon} coverageThin={model.horizonCoverageThin} />
      <HorizonMixCard model={model.horizon} coverageThin={model.horizonCoverageThin} />
      <CapacityCard model={model.capacity} coverageThin={model.capacityCoverageThin} />
    </div>
  );
}

function HorizonCard({
  model,
  coverageThin,
}: {
  model: PortfolioGuardrailsModel["horizon"];
  coverageThin: boolean;
}) {
  return (
    <CardShell
      title="Investment by Horizon"
      subtitle="Portfolio-Kanban × Horizon — pro Stage ein Turm aus Epic-Quadraten"
      status={model.status}
    >
      <HorizonStageTower epicsByStage={model.epicsByStage} />
      <HorizonShareLegend rows={model.rows} />
      <Footer
        unclassifiedCount={model.unclassifiedCount}
        totalCount={model.totalCount}
        coverageThin={coverageThin}
        coverageLabel="ohne Horizon"
      />
    </CardShell>
  );
}

/**
 * Spiegel-Card: Spalten = Horizonte (H1/H2/H3/Ohne), Quadrate pro Spalte
 * unifarben in der Horizon-Farbe. Stage-Info wandert in den Tooltip; die
 * Sortierung pro Spalte folgt dem Stage-Index (L0 unten, L5 oben).
 */
function HorizonMixCard({
  model,
  coverageThin,
}: {
  model: PortfolioGuardrailsModel["horizon"];
  coverageThin: boolean;
}) {
  return (
    <CardShell
      title="Investment by Horizon · Mix"
      subtitle="Pro Horizon ein Turm — wie viele Epics in jedem Horizon"
      status={model.status}
    >
      <HorizonHorizonTower epicsByHorizon={model.epicsByHorizon} />
      <HorizonShareLegend rows={model.rows} />
      <Footer
        unclassifiedCount={model.unclassifiedCount}
        totalCount={model.totalCount}
        coverageThin={coverageThin}
        coverageLabel="ohne Horizon"
      />
    </CardShell>
  );
}

const HORIZON_COLUMN_LABEL: Record<HorizonColumn, string> = {
  h1: HORIZON_LABEL.h1,
  h2: HORIZON_LABEL.h2,
  h3: HORIZON_LABEL.h3,
  none: "Ohne",
};
const HORIZON_COLUMN_COLOR: Record<HorizonColumn, string> = {
  h1: HORIZON_COLOR.h1 ?? "bg-muted-foreground/30",
  h2: HORIZON_COLOR.h2 ?? "bg-muted-foreground/30",
  h3: HORIZON_COLOR.h3 ?? "bg-muted-foreground/30",
  none: "bg-muted-foreground/30",
};

function HorizonHorizonTower({
  epicsByHorizon,
}: {
  epicsByHorizon: Record<HorizonColumn, StageTowerEpic[]>;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {HORIZON_COLUMNS.map((c) => {
        const epics = epicsByHorizon[c];
        const color = HORIZON_COLUMN_COLOR[c];
        return (
          <div key={c} className="group flex flex-col items-center gap-1.5">
            <div className="w-full text-center text-xs font-medium tabular-nums text-muted-foreground">
              {epics.length}
            </div>
            <EpicSquaresGrid
              epics={epics}
              renderSquare={(e, idx) => (
                <EpicSquare
                  key={e.id}
                  colorClass={color}
                  steering={e.needsSteeringAttention}
                  delayMs={idx * 30}
                  tooltip={mixTooltip(e)}
                />
              )}
            />
            <span className="text-center text-[10px] leading-tight text-muted-foreground">
              <span className="text-xs font-semibold text-foreground/80">
                {c === "none" ? "—" : c.toUpperCase()}
              </span>
              <br />
              {HORIZON_COLUMN_LABEL[c]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function mixTooltip(e: StageTowerEpic): string {
  const stageLabel = STAGE_GATE_LABELS[e.stageGate] ?? e.stageGate;
  const steering = e.needsSteeringAttention ? " · ⚠ Steering" : "";
  return `${e.title} · ${e.stageGate} ${stageLabel}${steering}`;
}

/**
 * Pro Stage eine Spalte: oben Counter (mit WIP-Limit-Marker), darunter
 * ein Stack 10×10-Quadrate — eines pro Epic, Horizon-gefaerbt. Epics
 * mit `needsSteeringAttention` bekommen einen roten Ring.
 */
function HorizonStageTower({
  epicsByStage,
}: {
  epicsByStage: Record<StageGate, StageTowerEpic[]>;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {STAGE_GATES.map((g) => {
        const epics = epicsByStage[g];
        const count = epics.length;
        const over = isOverWip(g, count);
        return (
          <div key={g} className="group flex flex-col items-center gap-1.5">
            <WipHeader stageGate={g} count={count} over={over} />
            <EpicSquaresGrid
              epics={epics}
              renderSquare={(e, idx) => (
                <EpicSquare
                  key={e.id}
                  colorClass={horizonSquareColor(e.horizon)}
                  steering={e.needsSteeringAttention}
                  delayMs={idx * 30}
                  tooltip={squareTooltip(e)}
                />
              )}
            />
            <span
              className="line-clamp-2 w-full text-center text-[10px] leading-tight text-muted-foreground"
              title={STAGE_GATE_LABELS[g]}
            >
              <span className="text-xs font-semibold text-foreground/80">{g}</span>
              <br />
              {STAGE_GATE_LABELS[g]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Spalten-Header: Count + WIP-Indikator + Mini-Fill-Bar.
 *  Fill-Bar zeigt blau bis zum Limit, rot fuer den overflow-Anteil.
 *  Bei limit=null (unendlich) wird die Bar als ganz schwache full-fill
 *  in muted-grau gerendert. */
function WipHeader({
  stageGate,
  count,
  over,
}: {
  stageGate: StageGate;
  count: number;
  over: boolean;
}) {
  const limit = PORTFOLIO_WIP_LIMITS[stageGate];
  return (
    <div
      className={`w-full space-y-0.5 rounded-md px-1 py-0.5 text-[10px] font-medium tabular-nums ${
        over ? "bg-red-100 text-red-700" : "text-muted-foreground"
      }`}
      title={over ? `WIP-Limit ueberschritten — ${wipCountLabel(stageGate, count)}` : undefined}
    >
      <div className="text-center">{wipCountLabel(stageGate, count)}</div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        {limit == null ? (
          <div className="h-full w-full bg-muted-foreground/15" />
        ) : (
          <div className="flex h-full w-full">
            <div
              className="h-full bg-foreground/60"
              style={{ width: `${Math.min(100, (Math.min(count, limit) / limit) * 100)}%` }}
            />
            {count > limit && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.min(100, ((count - limit) / limit) * 100)}%` }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function horizonSquareColor(h: Horizon | null): string {
  if (h == null) return "bg-muted-foreground/30";
  return HORIZON_COLOR[h] ?? "bg-muted-foreground/30";
}

function squareTooltip(e: StageTowerEpic): string {
  const horizonLabel = e.horizon ? HORIZON_LABEL[e.horizon] : "Horizon ungesetzt";
  const steering = e.needsSteeringAttention ? " · ⚠ Steering" : "";
  return `${e.title} · ${horizonLabel}${steering}`;
}

function HorizonShareLegend({ rows }: { rows: Record<Horizon, MixRow> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {HORIZONS.map((h) => {
        const row = rows[h];
        const delta = row.deltaCount;
        const deltaClass =
          Math.abs(delta) <= 0.05
            ? "text-emerald-700"
            : Math.abs(delta) <= 0.15
              ? "text-amber-700"
              : "text-red-700";
        return (
          <li key={h} className="inline-flex items-center gap-1">
            <span
              className={`size-2 shrink-0 rounded-sm ${HORIZON_COLOR[h] ?? "bg-muted"}`}
              aria-hidden
            />
            <span className="text-muted-foreground">{HORIZON_LABEL[h]}:</span>
            <span className="tabular-nums">{pct(row.countShare)}</span>
            <span className="text-muted-foreground/80">
              · Soll {pct(row.target)} · <span className={deltaClass}>{ppDelta(delta)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CapacityCard({
  model,
  coverageThin,
}: {
  model: PortfolioGuardrailsModel["capacity"];
  coverageThin: boolean;
}) {
  return (
    <CardShell
      title="Capacity Allocation"
      subtitle="Wertstiftende Arbeit vs. Architectural Runway / Enabler"
      status={model.status}
    >
      <StackedBar
        rows={(["business", "enabler"] as const).map((b) => ({
          key: b,
          label: BUCKET_LABEL[b],
          color: BUCKET_COLOR[b],
          row: model.rows[b],
        }))}
      />
      <Footer
        unclassifiedCount={model.unclassifiedCount}
        totalCount={model.totalCount}
        coverageThin={coverageThin}
        coverageLabel="ohne Typ"
      />
    </CardShell>
  );
}

function CardShell({
  title,
  subtitle,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  status: PortfolioGuardrailsModel["horizon"]["status"];
  children: ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            STATUS_CLASS[status]
          } ${status === "red" ? "animate-pulse" : ""}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>
      {children}
    </Card>
  );
}

interface StackedBarRow {
  key: string;
  label: string;
  color: string;
  row: MixRow;
}

function StackedBar({ rows }: { rows: StackedBarRow[] }) {
  const hasCountData = rows.some((r) => r.row.count > 0);
  const hasAmountData = rows.some((r) => r.row.amount > 0);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span>Ist (Anzahl)</span>
          <span className="normal-case text-muted-foreground/80">
            Σ {rows.reduce((acc, r) => acc + r.row.count, 0)} Epics
          </span>
        </p>
        <StackedBarTrack rows={rows} pick="count" hasData={hasCountData} />
        <Legend rows={rows} pick="count" />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Ist (€ Implementierungskosten)
        </p>
        <StackedBarTrack rows={rows} pick="amount" hasData={hasAmountData} />
        <Legend rows={rows} pick="amount" />
      </div>
    </div>
  );
}

function StackedBarTrack({
  rows,
  pick,
  hasData,
}: {
  rows: StackedBarRow[];
  pick: "count" | "amount";
  hasData: boolean;
}) {
  if (!hasData) {
    return (
      <div className="flex h-3 items-center rounded-full bg-muted px-2 text-[10px] text-muted-foreground">
        Noch keine Daten klassifiziert.
      </div>
    );
  }
  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-muted">
      <div className="flex h-full w-full">
        {rows.map((r) => {
          const share = pick === "count" ? r.row.countShare : r.row.amountShare;
          if (share <= 0) return null;
          return (
            <div
              key={r.key}
              className={r.color}
              style={{ width: `${share * 100}%` }}
              title={`${r.label}: ${pct(share)}`}
            />
          );
        })}
      </div>
      {/* Target marker — cumulative target boundaries */}
      <div className="pointer-events-none absolute inset-0">
        {cumulativeTargets(rows).map((t) => (
          <span
            key={`${t.key}-target`}
            className="absolute top-0 h-full w-px bg-foreground/70"
            style={{ left: `${t.atPct}%` }}
            title={`Target ${t.label}: kumuliert ${t.atPct.toFixed(0)}%`}
          />
        ))}
      </div>
    </div>
  );
}

function Legend({ rows, pick }: { rows: StackedBarRow[]; pick: "count" | "amount" }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {rows.map((r) => {
        const share = pick === "count" ? r.row.countShare : r.row.amountShare;
        const delta = pick === "count" ? r.row.deltaCount : r.row.deltaAmount;
        const deltaClass =
          Math.abs(delta) <= 0.05
            ? "text-emerald-700"
            : Math.abs(delta) <= 0.15
              ? "text-amber-700"
              : "text-red-700";
        return (
          <li key={r.key} className="inline-flex items-center gap-1">
            <span className={`size-2 shrink-0 rounded-sm ${r.color}`} aria-hidden />
            <span className="text-muted-foreground">{r.label}:</span>
            <span className="tabular-nums">{pct(share)}</span>
            <span className="text-muted-foreground/80">
              · Soll {pct(r.row.target)} · <span className={deltaClass}>{ppDelta(delta)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function cumulativeTargets(rows: StackedBarRow[]): { key: string; label: string; atPct: number }[] {
  const out: { key: string; label: string; atPct: number }[] = [];
  let cum = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const r = rows[i]!;
    cum += r.row.target;
    out.push({ key: r.key, label: r.label, atPct: cum * 100 });
  }
  return out;
}

function Footer({
  unclassifiedCount,
  totalCount,
  coverageThin,
  coverageLabel,
}: {
  unclassifiedCount: number;
  totalCount: number;
  coverageThin: boolean;
  coverageLabel: string;
}) {
  if (totalCount === 0) {
    return <p className="text-xs text-muted-foreground">Noch keine Epics im Portfolio.</p>;
  }
  if (unclassifiedCount === 0) return null;
  if (coverageThin) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-amber-200/60 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
      >
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          {unclassifiedCount} von {totalCount} Epics {coverageLabel} — Mix ist nur Indiz.
        </p>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {unclassifiedCount} von {totalCount} Epics {coverageLabel}.
    </p>
  );
}
