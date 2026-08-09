import { Stat, StatStrip } from "@/components/ui/stat";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { CompactKanban } from "@/features/portfolio/overview/blocks/compact-kanban";
import { HealthAlertsBlock } from "@/features/portfolio/overview/blocks/health-alerts-block";
import { FundingSnapshotTable } from "@/features/portfolio/overview/blocks/funding-snapshot-table";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Hero — single-screen layout: a 5-stat strip on top, the same compact kanban,
 * and a two-column footer with health alerts and the per-VS funding snapshot.
 * Trades depth for at-a-glance density.
 */
export function OverviewHero({ data }: { data: PortfolioOverview }) {
  const inFlight =
    data.epicsByGate.L2.length + data.epicsByGate.L3.length + data.epicsByGate.L4.length;
  return (
    <div className="space-y-6">
      <StatStrip>
        <Stat label="Epics in Flow" value={inFlight} />
        <Stat
          label="Pool alloziert"
          value={data.poolTotal > 0 ? pct(data.poolAllocated / data.poolTotal) : "—"}
        />
        <Stat label="Ø Ziele erreicht" value={pct(data.goalAverageProgress)} />
        <Stat label="PIs aktiv" value={data.activePis.length} />
        <Stat label="Impediments" value={data.impedimentsOpen} />
      </StatStrip>

      <CompactKanban data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <HealthAlertsBlock data={data} />
        <FundingSnapshotTable data={data} />
      </div>
    </div>
  );
}
