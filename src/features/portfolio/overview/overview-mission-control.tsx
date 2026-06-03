import type { PortfolioOverview } from "@/server/services/portfolio-overview";
import { PeriodBanner } from "@/features/portfolio/overview/blocks/period-banner";
import { StrategicBlock } from "@/features/portfolio/overview/blocks/strategic-block";
import { FundingBlock } from "@/features/portfolio/overview/blocks/funding-block";
import { CompactKanban } from "@/features/portfolio/overview/blocks/compact-kanban";
import { TopWinsBlock } from "@/features/portfolio/overview/blocks/top-wins-block";
import { HealthAlertsBlock } from "@/features/portfolio/overview/blocks/health-alerts-block";
import { RecentActivityBlock } from "@/features/portfolio/overview/blocks/recent-activity-block";

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

      <div className="grid gap-4 md:grid-cols-2">
        <TopWinsBlock data={data} />
        <HealthAlertsBlock data={data} />
      </div>

      <RecentActivityBlock data={data} />
    </div>
  );
}
