import type { PortfolioOverview } from "@/server/views/portfolio-overview";
import { TopWinsBlock } from "@/features/portfolio/overview/blocks/top-wins-block";
import { TopRisksBlock } from "@/features/portfolio/overview/blocks/top-risks-block";
import { PipelineBarsBlock } from "@/features/portfolio/overview/blocks/pipeline-bars-block";
import { NextStepsBlock } from "@/features/portfolio/overview/blocks/next-steps-block";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function eur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${Math.round(n)} €`;
}

function germanDate(d: Date): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Executive Briefing — text-heavy, low-chart layout. Three labelled headline
 * lines (Strategy / Funding / Time), a Wins/Risks pair, a pipeline bars block,
 * and the structural next-steps. Reads like a weekly status report.
 */
export function OverviewExecutive({ data }: { data: PortfolioOverview }) {
  const activeGoalCount = data.goals.filter((g) => g.status === "active").length;
  return (
    <div className="space-y-6">
      <header className="text-sm text-muted-foreground">
        Stand: {germanDate(new Date())} · automatisch erzeugt
      </header>

      <div className="space-y-2 rounded-md border bg-muted/20 p-4">
        <p className="text-sm">
          <span className="mr-2 font-semibold">🎯 STRATEGIE</span>
          {activeGoalCount === 0
            ? "Keine aktiven Ziele hinterlegt"
            : `${data.goalsOnTrack} von ${activeGoalCount} Zielen on track · Ø KPI-Erreichung ${pct(
                data.goalAverageProgress,
              )}`}
        </p>
        <p className="text-sm">
          <span className="mr-2 font-semibold">💰 FUNDING</span>
          {data.budgets.length === 0
            ? "Noch keine Budgets verteilt"
            : `${eur(data.poolAllocated)} alloziert · ${data.valueStreamCount} Wertström${data.valueStreamCount === 1 ? "" : "e"}`}
        </p>
        <p className="text-sm">
          <span className="mr-2 font-semibold">⏱ ZEITKONTEXT</span>
          {data.activePis.length === 0
            ? "Aktuell keine aktive PI"
            : `${data.activePis.length} PI${data.activePis.length === 1 ? "" : "s"} aktiv${
                data.nearestPiEnd
                  ? ` · ${data.nearestPiEnd.daysRemaining} Tage bis ${data.nearestPiEnd.name}-Ende`
                  : ""
              }`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopWinsBlock data={data} />
        <TopRisksBlock data={data} />
      </div>

      <PipelineBarsBlock data={data} />

      <NextStepsBlock data={data} />
    </div>
  );
}
