import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
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
 * Umsetzung, Budget-Ist gegen die Guardrails, Risiken. Die Abhängigkeiten
 * gehören Drumbeat, und Work darf Drumbeat nicht lesen (ADR-0013) — deshalb
 * ein Link statt einer Zahl.
 */
export function OverviewSync({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <MeetingHeader meeting="portfolio-sync" />
      <PeriodBanner data={data} />

      <SteeringTableBlock data={data} />

      <div className="grid items-start gap-4 md:grid-cols-2">
        <TopRisksBlock data={data} />
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

      {data.budgetingEnabled && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <FundingSnapshotTable data={data} />
          <BudgetKpiLinks data={data} />
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

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.risksEnabled && (
          <Link href="/issues" className="text-primary hover:underline">
            {t("work.overview.alleIssues")}
          </Link>
        )}
        <Link href="/dependencies" className="text-primary hover:underline">
          {t("work.overview.abhaengigkeitenUeberArts")}
        </Link>
      </p>
    </div>
  );
}

/**
 * Je Wertstrom der Weg zu seinen Budget-KPIs: Deckung, Lücke und die
 * PI-Velocity der ARTs. Die Zahlen gehören Budgeting und Drumbeat; hier steht
 * der Link, nicht die Rechnung.
 */
function BudgetKpiLinks({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>{t("work.overview.budgetKpisJeWertstrom")}</SectionLabel>
      {data.budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("work.overview.execNoBudgets")}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {data.budgets.map((b) => (
            <li key={b.valueStreamId}>
              <Link
                href={`/budgeting/value-streams/${b.valueStreamId}?tab=kpi` as never}
                className="text-primary hover:underline"
              >
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
