import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import type { KpiValueStreamOption } from "@/modules/work/domain/budget-kpi-selection";
import { BudgetKpiSelect } from "@/modules/work/features/portfolio/overview/budget-kpi-select";
import { MeetingHeader } from "@/modules/work/features/portfolio/overview/meeting-header";
import { GuardrailsLink } from "@/modules/work/features/portfolio/overview/overview-review";
import { PeriodBanner } from "@/modules/work/features/portfolio/overview/blocks/period-banner";
import { SteeringTableBlock } from "@/modules/work/features/portfolio/overview/blocks/steering-table-block";
import { TopRisksBlock } from "@/modules/work/features/portfolio/overview/blocks/top-risks-block";
import { PipelineBarsBlock } from "@/modules/work/features/portfolio/overview/blocks/pipeline-bars-block";
import { DueSoonBlock } from "@/modules/work/features/portfolio/overview/blocks/due-soon-block";
import { FundingSnapshotTable } from "@/modules/work/features/portfolio/overview/blocks/funding-snapshot-table";
import { HorizonFunnelBlock } from "@/modules/work/features/portfolio/overview/blocks/horizon-funnel-block";
import { RisksBlock } from "@/modules/work/features/portfolio/overview/blocks/risks-block";

/**
 * **Portfolio Sync** (monatlich) — „Was läuft, was hakt, was eskalieren wir?"
 *
 * Die Agenda steht oben: die Epics, die fürs Steering markiert sind. Darunter
 * Umsetzung, Budget-Ist gegen die Guardrails, Risiken. Abhängigkeiten stehen
 * im Netzplan der Umsetzung und im Epic — eine eigene Übersicht gibt es seit
 * September 2026 nicht mehr.
 *
 * Neben dem Funding-Snapshot steht der **Job-Size-Verlauf** eines Wertstroms
 * (oder eines seiner ARTs), mit Auswahl: liefern wir, was das Geld kaufen
 * sollte? Rechnung und Grafik gehören Budgeting; die Seite setzt sie zusammen
 * und reicht sie als Slot herein (`burn`).
 */
export interface SyncBurn {
  options: readonly KpiValueStreamOption[];
  selectedVs: string | null;
  /** `null` = „Wertstrom gesamt". */
  selectedArt: string | null;
  /** Der Graf der Auswahl — von der Composition Root gerendert. */
  chart: ReactNode;
}

export function OverviewSync({
  data,
  burn,
}: {
  data: PortfolioOverview;
  /** Ohne Budgeting-Modul fehlt er; der Funding-Snapshot steht dann allein. */
  burn?: SyncBurn | undefined;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <MeetingHeader meeting="portfolio-sync" />
      <PeriodBanner data={data} />

      <SteeringTableBlock data={data} />

      {/* Die kritischen Risiken kommen aus dem Issue-Register — ohne das
          Risiken-Modul gibt es sie nicht, und der Block fehlt wie der ROAM-Block. */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {data.risksEnabled && <TopRisksBlock data={data} />}
        <PipelineBarsBlock data={data} />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        <DueSoonBlock
          label={t("work.overview.lAbschlussFaelligWochen")}
          items={data.l4DueSoon}
          hrefBase="/portfolio/epics"
          emptyText={t("work.overview.keinEpicL4Faellig")}
          classFilter={data.classFilter}
        />
        <DueSoonBlock
          label={t("work.overview.featuresFaelligWochen")}
          items={data.featuresDueSoon}
          hrefBase="/feature"
          emptyText={t("work.overview.keinFeatureFaellig")}
          classFilter={data.classFilter}
        />
      </div>

      {/* Halbe-halbe: links das Geld je Wertstrom, rechts, was es liefert.
          Beide Karten gleich hoch — `items-stretch` und `h-full` an den Karten. */}
      {data.budgetingEnabled && (
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          <FundingSnapshotTable data={data} />
          {burn && <BurnCard burn={burn} />}
        </div>
      )}
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

      {data.risksEnabled && <RisksBlock data={data} />}

      {data.risksEnabled && (
        <p className="text-sm">
          <Link href="/issues" className="text-primary hover:underline">
            {t("work.overview.alleIssues")}
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * Der Job-Size-Verlauf der Auswahl: oben die Auswahl, darunter der Graf. Die
 * Überschrift trägt der Graf selbst („Job Size: Plan gegen Ist" samt Kachel).
 */
function BurnCard({ burn }: { burn: SyncBurn }) {
  const t = useTranslations();
  return (
    <Card className="h-full space-y-3 p-4" data-card="burn">
      {burn.selectedVs ? (
        <>
          <BudgetKpiSelect
            options={burn.options}
            selectedVs={burn.selectedVs}
            selectedArt={burn.selectedArt}
          />
          {burn.chart}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("work.overview.keineBudgetKpisSichtbar")}
        </p>
      )}
    </Card>
  );
}
