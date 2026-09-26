import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Stat, StatStrip } from "@/components/ui/stat";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { isClosed } from "@/modules/core/goals/domain/goal-status";
import type { ContributionView } from "@/modules/work/domain/contribution-view-preference";
import { MeetingHeader } from "@/modules/work/features/portfolio/overview/meeting-header";
import { StrategicBlock } from "@/modules/work/features/portfolio/overview/blocks/strategic-block";
import { GoalContributionBlock } from "@/modules/work/features/portfolio/overview/blocks/goal-contribution-block";
import { HorizonFunnelBlock } from "@/modules/work/features/portfolio/overview/blocks/horizon-funnel-block";
import { RequestedDecisionsBlock } from "@/modules/work/features/portfolio/overview/blocks/requested-decisions-block";
import { CompactKanban } from "@/modules/work/features/portfolio/overview/blocks/compact-kanban";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * **Strategic Portfolio Review** (quartalsweise) — „Stimmt die Richtung, und
 * worüber entscheiden wir?"
 *
 * In der Reihenfolge der Agenda: Kennzahlen, Ziele und wer auf sie einzahlt,
 * die Richtung des Geldes gegen die Guardrails, dann die anstehenden
 * Go/No-Go-Entscheidungen mit dem Kanban darunter. Fälligkeiten, letzte
 * Aktivität und das ROAM-Brett fehlen mit Absicht: das ist operativ und
 * gehört in den Portfolio Sync.
 */
export function OverviewReview({
  data,
  contributionView,
}: {
  data: PortfolioOverview;
  contributionView: ContributionView;
}) {
  const t = useTranslations();
  // Dieselbe Zählung wie die Ziel-Karte darunter (`strategic-block.tsx`) —
  // sonst stünden zwei Antworten auf „wie viele Ziele" nebeneinander.
  const aktiv = data.goals.filter((g) => !isClosed(g.status)).length;
  return (
    <div className="space-y-6">
      <MeetingHeader meeting="strategic-portfolio-review" />

      <StatStrip className="flex-wrap">
        <Stat
          label={t("work.overview.kpiZieleAufKurs")}
          value={aktiv === 0 ? "—" : `${data.goalsOnTrack} / ${aktiv}`}
        />
        <Stat label={t("work.overview.kpiZielfortschritt")} value={pct(data.goalAverageProgress)} />
        <Stat label={t("work.overview.kpiFertig90Tage")} value={data.doneInLast90Days} />
        <Stat label={t("work.overview.kpiFunnelKonversion")} value={pct(data.funnelConversion)} />
      </StatStrip>

      <div className="grid gap-4 md:grid-cols-3">
        <StrategicBlock data={data} />
        <div className="md:col-span-2">
          <GoalContributionBlock
            rows={data.goalContributions}
            classFilter={data.classFilter}
            initialView={contributionView}
          />
        </div>
      </div>

      {data.horizonOnOverview && (
        <div className="space-y-2">
          <HorizonFunnelBlock
            items={data.funnelItems}
            cycleKey={data.budgetCycleKey}
            horizonTargets={data.horizonTargets}
            pool={data.budgetPool}
            budgetingEnabled={data.budgetingEnabled}
          />
          <GuardrailsLink />
        </div>
      )}

      <RequestedDecisionsBlock data={data} />
      <CompactKanban data={data} />
    </div>
  );
}

export function GuardrailsLink() {
  const t = useTranslations();
  return (
    <p className="text-right text-sm">
      <Link href="/portfolio/guardrails" className="text-primary hover:underline">
        {t("work.overview.guardrailsImDetail")}
      </Link>
    </p>
  );
}
