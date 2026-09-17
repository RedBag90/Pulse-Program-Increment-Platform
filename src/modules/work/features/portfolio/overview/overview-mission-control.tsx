import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { PeriodBanner } from "@/modules/work/features/portfolio/overview/blocks/period-banner";
import { StrategicBlock } from "@/modules/work/features/portfolio/overview/blocks/strategic-block";
import { GoalContributionBlock } from "@/modules/work/features/portfolio/overview/blocks/goal-contribution-block";
import { CompactKanban } from "@/modules/work/features/portfolio/overview/blocks/compact-kanban";
import { HorizonFunnelBlock } from "@/modules/work/features/portfolio/overview/blocks/horizon-funnel-block";
import { DueSoonBlock } from "@/modules/work/features/portfolio/overview/blocks/due-soon-block";
import { RisksBlock } from "@/modules/work/features/portfolio/overview/blocks/risks-block";
import { SteeringTableBlock } from "@/modules/work/features/portfolio/overview/blocks/steering-table-block";
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

      {/* 1/3 : 2/3 — links ein Ziel mit einem Balken, rechts eine Tabelle mit
          sechs Spalten und umbrechenden Epic-Titeln. Haelftig geteilt bekam die
          Beitrags-Kachel zu wenig Platz. Nur diese Rasterzeile; die beiden
          anderen der Uebersicht bleiben zweispaltig. */}
      <div className="grid gap-4 md:grid-cols-3">
        <StrategicBlock data={data} />
        <div className="md:col-span-2">
          <GoalContributionBlock rows={data.goalContributions} classFilter={data.classFilter} />
        </div>
      </div>

      {/* Die Ebene zwischen Epic und Portfolio: welches Produkt steht wo, und
          wie viel Geld bindet es dort. Über dem Kanban, weil es den Rahmen
          setzt, in dem die Epics darunter laufen. */}
      <HorizonFunnelBlock
        items={data.funnelItems}
        cycleKey={data.budgetCycleKey}
        horizonTargets={data.horizonTargets}
        budgetingEnabled={data.budgetingEnabled}
      />

      <CompactKanban data={data} />

      {/* Beide „Fällig"-Kacheln über die volle Breite, untereinander. Sie
          standen bis zuletzt zu zweit in einer Spalte neben den Risiken — und
          weil das Raster stretcht, die Liste darin aber bei ihren 384 px blieb,
          lief die Risiko-Karte unten leer weiter. */}
      <DueSoonBlock
        label="L4-Abschluss fällig (≤ 4 Wochen)"
        items={data.l4DueSoon}
        hrefBase="/portfolio/epics"
        emptyText="Kein Epic mit geplantem L4-Abschluss in den nächsten 4 Wochen."
        classFilter={data.classFilter}
      />
      <DueSoonBlock
        label="Features fällig (≤ 2 Wochen)"
        items={data.featuresDueSoon}
        hrefBase="/feature"
        emptyText="Kein Feature mit geplantem Abschluss in den nächsten 2 Wochen."
        classFilter={data.classFilter}
      />

      {/* Bringt sein eigenes Drei-Spalten-Raster mit — eine Kachel je
          ROAM-Zustand. */}
      <RisksBlock data={data} />

      <SteeringTableBlock data={data} />

      <RecentActivityBlock data={data} />
    </div>
  );
}
