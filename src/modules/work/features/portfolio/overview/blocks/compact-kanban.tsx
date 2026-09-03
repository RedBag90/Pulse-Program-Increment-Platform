"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Flag } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";
import {
  STAGE_GATES,
  STAGE_GATE_LABEL,
  HORIZON_LANES,
  type PortfolioOverview,
  type OverviewEpicCard,
  type HorizonBudgetFigures,
  type ClassFilterState,
} from "@/modules/work/server/views/portfolio-overview";
import {
  isClassShown,
  rollUpBySolution,
  type SolutionRollup,
} from "@/modules/work/domain/epic-class-filter";
import type { EpicClass } from "@/modules/work/domain/pb-submission";
import {
  RollupHint,
  rollupTone,
} from "@/modules/work/features/portfolio/overview/blocks/class-rollup";
import { wipCountLabel, isOverWip } from "@/modules/work/features/portfolio/overview/wip-limits";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";
import { formatCompactEUR } from "@/lib/formatting";

/** „2026-H1" → „H1 2026" für die kompakte Zyklus-Caption. */
function cycleLabel(key: string): string {
  const m = /^(\d{4})-(H[12])$/.exec(key);
  return m ? `${m[2]} ${m[1]}` : key;
}

const CELL_LIMIT = 4;

/**
 * Read-only Portfolio-Kanban als **Matrix**: Zeilen = Investitionshorizonte
 * (H3→H2→H1→H0→Ohne, aus der Primär-Solution), Spalten = Stage Gates. Soft-WIP je
 * Spalte. Editieren (Drag&Drop, Stage-Wechsel) lebt auf `/portfolio/epics`.
 *
 * Bei aktiver Klassen-Facette steht die nicht gewählte Klasse je Zelle als
 * Sammelkarte unter den Karten. Die **WIP-Zähler bleiben davon unberührt**: sie
 * zählen weiter alle Epics der Spalte. Ein Limit, das Entwarnung meldet, weil
 * jemand gefiltert hat, wäre schlimmer als keines.
 */
export function CompactKanban({ data }: { data: PortfolioOverview }) {
  return (
    <section className="space-y-2" data-tour="portfolio-kanban">
      <div className="flex items-center justify-between">
        <SectionLabel>Epic Portfolio-Kanban · Horizonte</SectionLabel>
        <Link
          href="/portfolio/epics"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Im Editor öffnen <ArrowRight className="size-3" />
        </Link>
      </div>

      <RollupHint classFilter={data.classFilter} detail="die Spaltenzähler bleiben vollständig" />

      <div className="overflow-x-auto">
        <div className="grid min-w-[960px] grid-cols-[180px_repeat(6,minmax(140px,1fr))] gap-2">
          {/* Kopfzeile: Stage-Gate-Spalten + WIP */}
          <div className="flex items-end">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Budget · {cycleLabel(data.budgetCycleKey)}
            </span>
          </div>
          {STAGE_GATES.map((gate) => {
            const over = isOverWip(gate, data.epicsByGate[gate].length);
            return (
              <div
                key={gate}
                className={cn(
                  "flex items-baseline justify-between gap-1 rounded-md border px-2 py-1.5",
                  over && "border-amber-300 bg-amber-100/60 dark:bg-amber-900/30",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {STAGE_GATE_LABEL[gate]}
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    over
                      ? "font-semibold text-amber-900 dark:text-amber-300"
                      : "text-muted-foreground",
                  )}
                >
                  {wipCountLabel(gate, data.epicsByGate[gate].length)}
                </span>
              </div>
            );
          })}

          {/* Swimlanes */}
          {HORIZON_LANES.map((lane) => (
            <LaneRow key={lane} lane={lane} data={data} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LaneRow({ lane, data }: { lane: string; data: PortfolioOverview }) {
  const row = data.epicsByHorizonGate[lane as keyof typeof data.epicsByHorizonGate];
  const budget = data.horizonBudgets[lane as keyof typeof data.horizonBudgets];
  return (
    <>
      <div className="flex flex-col justify-center gap-1.5 py-1">
        <HorizonBadge horizon={lane === "none" ? null : lane} withHelp />
        {budget && budget.budgetiert > 0 && <HorizonBudget budget={budget} />}
      </div>
      {STAGE_GATES.map((gate) => (
        <KanbanCell key={gate} lane={lane} epics={row[gate]} classFilter={data.classFilter} />
      ))}
    </>
  );
}

/** Drei Budget-Werte des laufenden Zyklus unter dem Horizont-Badge. */
function HorizonBudget({ budget }: { budget: HorizonBudgetFigures }) {
  return (
    <div className="leading-tight">
      <p className="text-xs font-semibold tabular-nums" title="Budgetiert (laufender Zyklus)">
        {formatCompactEUR(budget.budgetiert)}
      </p>
      <p
        className="text-[10px] tabular-nums text-muted-foreground"
        title="Davon in Umsetzung (Implementing / L4)"
      >
        ▸ Umsetzung {formatCompactEUR(budget.umsetzung)}
      </p>
      <p
        className="text-[10px] tabular-nums text-muted-foreground"
        title="Davon umgesetzt (Done / L5)"
      >
        ✓ umgesetzt {formatCompactEUR(budget.umgesetzt)}
      </p>
    </div>
  );
}

const LANE_TINT: Record<string, string> = {
  h3: "bg-fuchsia-50/50 dark:bg-fuchsia-950/20",
  h2: "bg-violet-50/50 dark:bg-violet-950/20",
  h1: "bg-blue-50/50 dark:bg-blue-950/20",
  h0: "bg-slate-100/60 dark:bg-slate-800/30",
  none: "bg-muted/40",
};

function KanbanCell({
  lane,
  epics,
  classFilter,
}: {
  lane: string;
  epics: OverviewEpicCard[];
  classFilter: ClassFilterState;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = epics.filter((e) => isClassShown(e.epicClass, classFilter.selected));
  const rollups = rollUpBySolution(
    epics.filter((e) => !isClassShown(e.epicClass, classFilter.selected)),
  );
  const shown = expanded ? visible : visible.slice(0, CELL_LIMIT);
  return (
    <div className={cn("min-h-[52px] rounded-md border p-1.5", LANE_TINT[lane] ?? "")}>
      <ul className="space-y-1 text-xs">
        {shown.map((e) => (
          <KanbanCard key={e.id} epic={e} />
        ))}
        {rollups.map((r) => (
          <SolutionCard key={r.solutionId ?? "none"} rollup={r} cls={classFilter.hiddenClass} />
        ))}
      </ul>
      {visible.length > CELL_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full text-center text-[10px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? "weniger" : `+ ${visible.length - CELL_LIMIT} weitere`}
        </button>
      )}
    </div>
  );
}

/**
 * Die zusammengefasste Klasse einer Zelle — eine Karte je Solution. Sie führt
 * auf die Solution, nicht auf ein Epic; „Ohne Solution" hat kein Ziel und
 * bleibt deshalb Text.
 */
function SolutionCard({ rollup, cls }: { rollup: SolutionRollup; cls: EpicClass | null }) {
  const body = (
    <>
      <span className="truncate font-medium leading-snug">{rollup.name}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums">{rollup.count}</span>
    </>
  );
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed px-2 py-1",
        rollupTone(cls),
      )}
    >
      {rollup.solutionId ? (
        <Link
          href={`/portfolio/solutions/${rollup.solutionId}`}
          className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
        >
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
    </li>
  );
}

function KanbanCard({ epic }: { epic: OverviewEpicCard }) {
  return (
    <li
      className={cn(
        "rounded-md border bg-background px-2 py-1",
        epic.needsSteeringAttention &&
          "border-l-2 border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/30",
      )}
    >
      <div className="flex items-center gap-1">
        {epic.needsSteeringAttention && (
          <Flag
            className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
            aria-label="Steering"
          />
        )}
        <Link
          href={`/portfolio/epics/${epic.id}`}
          className="truncate font-medium leading-snug hover:text-primary"
        >
          {epic.title}
        </Link>
      </div>
      {epic.valueStream && (
        <p className="truncate text-[10px] text-muted-foreground">{epic.valueStream.name}</p>
      )}
    </li>
  );
}
