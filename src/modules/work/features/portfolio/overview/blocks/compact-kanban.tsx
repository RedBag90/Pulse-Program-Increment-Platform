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
} from "@/modules/work/server/views/portfolio-overview";
import { wipCountLabel, isOverWip } from "@/modules/work/features/portfolio/overview/wip-limits";
import { HorizonBadge } from "@/modules/work/features/portfolio/components/horizon-badge";

const CELL_LIMIT = 4;

/**
 * Read-only Portfolio-Kanban als **Matrix**: Zeilen = Investitionshorizonte
 * (H3→H2→H1→H0→Ohne, aus der Primär-Solution), Spalten = Stage Gates. Soft-WIP je
 * Spalte. Editieren (Drag&Drop, Stage-Wechsel) lebt auf `/portfolio/epics`.
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

      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[120px_repeat(6,minmax(140px,1fr))] gap-2">
          {/* Kopfzeile: Stage-Gate-Spalten + WIP */}
          <div />
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
                    over ? "font-semibold text-amber-900 dark:text-amber-300" : "text-muted-foreground",
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
  return (
    <>
      <div className="flex items-center">
        <HorizonBadge horizon={lane === "none" ? null : lane} withHelp />
      </div>
      {STAGE_GATES.map((gate) => (
        <KanbanCell key={gate} lane={lane} epics={row[gate]} />
      ))}
    </>
  );
}

const LANE_TINT: Record<string, string> = {
  h3: "bg-fuchsia-50/50 dark:bg-fuchsia-950/20",
  h2: "bg-violet-50/50 dark:bg-violet-950/20",
  h1: "bg-blue-50/50 dark:bg-blue-950/20",
  h0: "bg-slate-100/60 dark:bg-slate-800/30",
  none: "bg-muted/40",
};

function KanbanCell({ lane, epics }: { lane: string; epics: OverviewEpicCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? epics : epics.slice(0, CELL_LIMIT);
  return (
    <div className={cn("min-h-[52px] rounded-md border p-1.5", LANE_TINT[lane] ?? "")}>
      <ul className="space-y-1 text-xs">
        {shown.map((e) => (
          <KanbanCard key={e.id} epic={e} />
        ))}
      </ul>
      {epics.length > CELL_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full text-center text-[10px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? "weniger" : `+ ${epics.length - CELL_LIMIT} weitere`}
        </button>
      )}
    </div>
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
          <Flag className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Steering" />
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
