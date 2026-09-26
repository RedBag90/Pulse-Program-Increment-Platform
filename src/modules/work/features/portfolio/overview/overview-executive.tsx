import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/formatting";
import type { Locale } from "@/i18n/routing";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { TopRisksBlock } from "@/modules/work/features/portfolio/overview/blocks/top-risks-block";
import { PipelineBarsBlock } from "@/modules/work/features/portfolio/overview/blocks/pipeline-bars-block";
import { NextStepsBlock } from "@/modules/work/features/portfolio/overview/blocks/next-steps-block";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function eur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${Math.round(n)} €`;
}

/**
 * Executive Briefing — text-heavy, low-chart layout. Three labelled headline
 * lines (Strategy / Funding / Time), a Wins/Risks pair, a pipeline bars block,
 * and the structural next-steps. Reads like a weekly status report.
 */
export function OverviewExecutive({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const activeGoalCount = data.goals.filter((g) => g.status === "active").length;
  return (
    <div className="space-y-6">
      <header className="text-sm text-muted-foreground">
        {t("work.overview.execGeneratedAt", { date: formatDate(new Date(), "date", locale) })}
      </header>

      <div className="space-y-2 rounded-md border bg-muted/20 p-4">
        <p className="text-sm">
          <span className="mr-2 font-semibold">{t("work.overview.strategie")}</span>
          {activeGoalCount === 0
            ? t("work.overview.execNoActiveGoals")
            : t("work.overview.execGoalsOnTrack", {
                onTrack: data.goalsOnTrack,
                total: activeGoalCount,
                pct: pct(data.goalAverageProgress),
              })}
        </p>
        <p className="text-sm">
          <span className="mr-2 font-semibold">{t("work.overview.funding")}</span>
          {data.budgets.length === 0
            ? t("work.overview.execNoBudgets")
            : data.valueStreamCount === 1
              ? t("work.overview.execAllocatedOneStream", {
                  amount: eur(data.poolAllocated),
                  count: data.valueStreamCount,
                })
              : t("work.overview.execAllocatedStreams", {
                  amount: eur(data.poolAllocated),
                  count: data.valueStreamCount,
                })}
        </p>
        <p className="text-sm">
          <span className="mr-2 font-semibold">{t("work.overview.zeitkontext")}</span>
          {data.activePis.length === 0
            ? t("work.overview.execNoActivePi")
            : data.nearestPiEnd
              ? data.activePis.length === 1
                ? t("work.overview.execPiActiveOneWithEnd", {
                    count: data.activePis.length,
                    days: data.nearestPiEnd.daysRemaining,
                    name: data.nearestPiEnd.name,
                  })
                : t("work.overview.execPiActiveOtherWithEnd", {
                    count: data.activePis.length,
                    days: data.nearestPiEnd.daysRemaining,
                    name: data.nearestPiEnd.name,
                  })
              : data.activePis.length === 1
                ? t("work.overview.activePiCountOne", { count: data.activePis.length })
                : t("work.overview.activePiCountOther", { count: data.activePis.length })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopRisksBlock data={data} />
      </div>

      <PipelineBarsBlock data={data} />

      <NextStepsBlock data={data} />
    </div>
  );
}
