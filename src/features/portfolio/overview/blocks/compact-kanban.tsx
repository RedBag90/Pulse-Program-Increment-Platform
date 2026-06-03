import { Link } from "@/i18n/navigation";
import { ArrowRight, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";
import {
  STAGE_GATES,
  STAGE_GATE_LABEL,
  type PortfolioOverview,
  type OverviewEpicCard,
} from "@/server/services/portfolio-overview";
import { wipCountLabel, isOverWip } from "@/features/portfolio/overview/wip-limits";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-blue-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-400",
  completed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/20",
};

/**
 * Read-only portfolio Kanban — six columns, soft WIP limits per column.
 * Editing (Drag&Drop, stage-gate transitions) lives on `/portfolio/epics`;
 * this view is a fast-scan health snapshot, with overfull columns marked.
 */
export function CompactKanban({ data }: { data: PortfolioOverview }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel>Epic Portfolio-Kanban</SectionLabel>
        <Link
          href="/portfolio/epics"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Im Editor öffnen <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {STAGE_GATES.map((gate) => {
            const epics = data.epicsByGate[gate];
            const over = isOverWip(gate, epics.length);
            return (
              <Card
                key={gate}
                className={cn(
                  "w-56 shrink-0 overflow-hidden p-0",
                  over && "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20",
                )}
              >
                <header
                  className={cn(
                    "flex items-baseline justify-between gap-2 border-b px-3 py-2",
                    over && "bg-amber-100/60 dark:bg-amber-900/30",
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    {STAGE_GATE_LABEL[gate]}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums",
                      over
                        ? "font-semibold text-amber-900 dark:text-amber-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {wipCountLabel(gate, epics.length)}
                  </span>
                </header>
                <ul className="space-y-1.5 p-2 text-xs">
                  {epics.length === 0 ? (
                    <li className="rounded-md border border-dashed py-3 text-center text-[11px] text-muted-foreground/60">
                      empty
                    </li>
                  ) : (
                    epics.slice(0, 6).map((e) => <KanbanCard key={e.id} epic={e} />)
                  )}
                  {epics.length > 6 && (
                    <li className="text-center text-[10px] text-muted-foreground">
                      + {epics.length - 6} weitere
                    </li>
                  )}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function KanbanCard({ epic }: { epic: OverviewEpicCard }) {
  return (
    <li
      className={cn(
        "space-y-0.5 rounded-md border bg-background px-2 py-1.5",
        // Steering flag — amber accent matches the Epic-overview pill and the
        // over-WIP column header so "needs attention" stays one colour.
        epic.needsSteeringAttention &&
          "border-l-2 border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/30",
      )}
    >
      <div className="flex items-center gap-1.5">
        {epic.needsSteeringAttention && (
          <Flag
            className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
            aria-label="Im nächsten Steering-Meeting behandeln"
          />
        )}
        <span
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[epic.status] ?? "bg-muted")}
        />
        <Link
          href={`/portfolio/epics/${epic.id}`}
          className="truncate font-medium leading-snug hover:text-primary"
        >
          {epic.title}
        </Link>
      </div>
      {epic.valueStream && (
        <p className="truncate pl-3 text-[10px] text-muted-foreground">{epic.valueStream.name}</p>
      )}
    </li>
  );
}
