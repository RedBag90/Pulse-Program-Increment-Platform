import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import {
  STAGE_GATES,
  STAGE_GATE_LABEL,
  type PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";
import { PORTFOLIO_WIP_LIMITS } from "@/features/portfolio/overview/wip-limits";

/**
 * Horizontal bar per stage gate — the executive variant's substitute for the
 * kanban. Plus a Done-90d bar to anchor what "shipped" looks like next to
 * "in-flight". Soft-limit overruns get a ⚠ trailing note.
 */
export function PipelineBarsBlock({ data }: { data: PortfolioOverview }) {
  const maxCount = Math.max(
    ...STAGE_GATES.map((g) => data.epicsByGate[g].length),
    data.doneInLast90Days,
    1,
  );

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Pipeline</SectionLabel>
      <ul className="space-y-2 text-sm">
        {STAGE_GATES.filter((g) => g !== "L5").map((g) => {
          const count = data.epicsByGate[g].length;
          const limit = PORTFOLIO_WIP_LIMITS[g];
          const over = limit !== null && count > limit;
          return (
            <li key={g} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <span className="text-xs text-muted-foreground">{STAGE_GATE_LABEL[g]}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary/70"}`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums">
                {count}
                {over && limit !== null && (
                  <span className="ml-1 text-[10px] text-amber-700">Limit {limit} ⚠</span>
                )}
              </span>
            </li>
          );
        })}
        <li className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-t pt-2">
          <span className="text-xs text-muted-foreground">Done (90 Tage)</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${(data.doneInLast90Days / maxCount) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums">{data.doneInLast90Days}</span>
        </li>
      </ul>
    </Card>
  );
}
