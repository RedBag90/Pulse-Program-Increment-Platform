import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import {
  PORTFOLIO_COLUMNS,
  PORTFOLIO_COLUMN_LABELS,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { PORTFOLIO_WIP_LIMITS } from "@/modules/work/features/portfolio/overview/column-meta";

/**
 * Horizontal bar per stage gate — the executive variant's substitute for the
 * kanban. Plus a Done-90d bar to anchor what "shipped" looks like next to
 * "in-flight". Soft-limit overruns get a ⚠ trailing note.
 */
export function PipelineBarsBlock({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  // **Die Balken zaehlen Spalten, nicht Reifegrade.** Vorher kam die Zahl aus
  // `epicsByGate` und die Grenze aus `PORTFOLIO_WIP_LIMITS` — zwei Achsen in
  // einer Zeile, und die Warnung „Limit ueberschritten" galt einem Engpass, den
  // das Kanban daneben anders zaehlte.
  const maxCount = Math.max(
    ...PORTFOLIO_COLUMNS.map((c) => data.epicsByColumn[c].length),
    data.doneInLast90Days,
    1,
  );

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>{t("work.overview.pipeline")}</SectionLabel>
      <ul className="space-y-2 text-xs">
        {PORTFOLIO_COLUMNS.map((col) => {
          const count = data.epicsByColumn[col].length;
          const limit = PORTFOLIO_WIP_LIMITS[col];
          const over = limit !== null && count > limit;
          return (
            <li key={col} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <span className="text-xs text-muted-foreground">{PORTFOLIO_COLUMN_LABELS[col]}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary/70"}`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs tabular-nums">
                {count}
                {over && limit !== null && (
                  <span className="ml-1 text-label text-warning">
                    {t("work.overview.pipelineLimitExceeded", { limit })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
        <li className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-t pt-2">
          <span className="text-xs text-muted-foreground">{t("work.overview.doneTage")}</span>
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
