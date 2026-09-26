import { useTranslations } from "next-intl";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import type { ContributionView } from "@/modules/work/domain/contribution-view-preference";
import { PeriodBanner } from "@/modules/work/features/portfolio/overview/blocks/period-banner";
import { StrategicBlock } from "@/modules/work/features/portfolio/overview/blocks/strategic-block";
import { GoalContributionBlock } from "@/modules/work/features/portfolio/overview/blocks/goal-contribution-block";
import { CompactKanban } from "@/modules/work/features/portfolio/overview/blocks/compact-kanban";
import { HorizonFunnelBlock } from "@/modules/work/features/portfolio/overview/blocks/horizon-funnel-block";
import { DueSoonBlock } from "@/modules/work/features/portfolio/overview/blocks/due-soon-block";
import { RisksBlock } from "@/modules/work/features/portfolio/overview/blocks/risks-block";
import { SteeringTableBlock } from "@/modules/work/features/portfolio/overview/blocks/steering-table-block";
import { RequestedDecisionsBlock } from "@/modules/work/features/portfolio/overview/blocks/requested-decisions-block";
import { RecentActivityBlock } from "@/modules/work/features/portfolio/overview/blocks/recent-activity-block";

/**
 * Mission Control — six-section cockpit. Time-context banner, two strategy/
 * funding cards, the compact kanban, then a flow + health pair, and recent
 * activity at the bottom. Designed for the operator who wants the full
 * picture in one scroll.
 */
export function OverviewMissionControl({
  data,
  contributionView,
}: {
  data: PortfolioOverview;
  /** Gespeicherte Stellung der Schalter der Beitrags-Kachel (siehe dort). */
  contributionView: ContributionView;
}) {
  const t = useTranslations();
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
          <GoalContributionBlock
            rows={data.goalContributions}
            classFilter={data.classFilter}
            initialView={contributionView}
          />
        </div>
      </div>

      {/* Die Ebene zwischen Epic und Portfolio: welches Produkt steht wo, und
          wie viel Geld bindet es dort. Über dem Kanban, weil es den Rahmen
          setzt, in dem die Epics darunter laufen.

          Wer nicht nach Horizonten steuert, schaltet die Achse im
          Guardrail-Formular ab — dann fehlt hier nicht nur die Zeichnung,
          sondern auch die Abfragewelle dahinter. */}
      {data.horizonOnOverview && (
        <HorizonFunnelBlock
          items={data.funnelItems}
          cycleKey={data.budgetCycleKey}
          horizonTargets={data.horizonTargets}
          budgetingEnabled={data.budgetingEnabled}
        />
      )}

      <CompactKanban data={data} />

      {/* Beide „Fällig"-Kacheln nebeneinander. In jeder Zeile stehen nur Titel,
          Datum und Frist — über die volle Breite war das mehr Weißraum als
          Information.

          **`items-start` ist hier nicht optional.** Genau diese Anordnung ist
          schon einmal gescheitert: die beiden Karten standen zu zweit in einer
          Spalte neben den Risiken, das Raster streckte die Spalte, die
          `max-h-96`-Liste darin wuchs aber nicht mit — und die Nachbarkarte lief
          unten leer weiter (dieselbe Falle steht in `risks-block.tsx` ein
          zweites Mal: **`max-height` gewinnt gegen Flex-Wachstum**). Ohne
          `items-start` zieht die längere Karte die kürzere auf ihre Höhe, und
          der Fehler ist zurück. Seit der Kappung auf sechs Zeilen sind beide
          ohnehin kurz; die Sperre bleibt trotzdem stehen. */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <DueSoonBlock
          label={t("work.overview.lAbschlussFaelligWochen")}
          items={data.l4DueSoon}
          hrefBase="/portfolio/epics"
          emptyText="Kein Epic mit geplantem L4-Abschluss in den nächsten 4 Wochen."
          classFilter={data.classFilter}
        />
        <DueSoonBlock
          label={t("work.overview.featuresFaelligWochen")}
          items={data.featuresDueSoon}
          hrefBase="/feature"
          emptyText="Kein Feature mit geplantem Abschluss in den nächsten 2 Wochen."
          classFilter={data.classFilter}
        />
      </div>

      {/* Bringt sein eigenes Drei-Spalten-Raster mit — eine Kachel je
          ROAM-Zustand.

          Ohne das Risiken-Modul gar nicht: fünf Kacheln mit lauter Nullen
          behaupten, der Mandant habe **keine** Risiken — in Wahrheit führt er
          sie nicht. Dieselbe Regel wie am Epic-Detail, wo der Issues-Reiter
          ohne Modul fehlt statt leer dazustehen. */}
      {data.risksEnabled && <RisksBlock data={data} />}

      <SteeringTableBlock data={data} />

      <RequestedDecisionsBlock data={data} />

      <RecentActivityBlock data={data} />
    </div>
  );
}
