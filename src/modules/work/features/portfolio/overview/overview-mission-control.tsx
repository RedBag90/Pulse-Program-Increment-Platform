import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { PeriodBanner } from "@/modules/work/features/portfolio/overview/blocks/period-banner";
import { StrategicBlock } from "@/modules/work/features/portfolio/overview/blocks/strategic-block";
import { FundingBlock } from "@/modules/work/features/portfolio/overview/blocks/funding-block";
import { CompactKanban } from "@/modules/work/features/portfolio/overview/blocks/compact-kanban";
import { DueSoonBlock } from "@/modules/work/features/portfolio/overview/blocks/due-soon-block";
import { TopWinsBlock } from "@/modules/work/features/portfolio/overview/blocks/top-wins-block";
import { HealthAlertsBlock } from "@/modules/work/features/portfolio/overview/blocks/health-alerts-block";
import { RecentActivityBlock } from "@/modules/work/features/portfolio/overview/blocks/recent-activity-block";

/**
 * Mission Control — six-section cockpit. Time-context banner, two strategy/
 * funding cards, the compact kanban, then a flow + health pair, and recent
 * activity at the bottom. Designed for the operator who wants the full
 * picture in one scroll.
 */
export function OverviewMissionControl({ data }: { data: PortfolioOverview }) {
  return (
    <div className="space-y-6">
      <PeriodBanner data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <StrategicBlock data={data} />
        <FundingBlock data={data} />
      </div>

      <CompactKanban data={data} />

      <DueSoonBlock
        label="L4-Abschluss fällig (≤ 4 Wochen)"
        items={data.l4DueSoon}
        hrefBase="/portfolio/epics"
        emptyText="Kein Epic mit geplantem L4-Abschluss in den nächsten 4 Wochen."
      />
      <DueSoonBlock
        label="Features fällig (≤ 2 Wochen)"
        items={data.featuresDueSoon}
        hrefBase="/feature"
        emptyText="Kein Feature mit geplantem Abschluss in den nächsten 2 Wochen."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TopWinsBlock data={data} />
        <HealthAlertsBlock data={data} />
      </div>

      <RecentActivityBlock data={data} />
    </div>
  );
}
