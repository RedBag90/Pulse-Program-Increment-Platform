import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Stat, StatStrip } from "@/components/ui/stat";
import { formatScaledEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { MeetingHeader } from "@/modules/work/features/portfolio/overview/meeting-header";
import { GuardrailsLink } from "@/modules/work/features/portfolio/overview/overview-review";
import { HorizonFunnelBlock } from "@/modules/work/features/portfolio/overview/blocks/horizon-funnel-block";
import { FundingSnapshotTable } from "@/modules/work/features/portfolio/overview/blocks/funding-snapshot-table";
import { BudgetCandidatesBlock } from "@/modules/work/features/portfolio/overview/blocks/budget-candidates-block";

/**
 * **Participatory Budgeting** (halbjährlich) — „Wie verteilen wir das Geld auf
 * die Wertströme?"
 *
 * Der Topf zuerst (gesamt, verteilt, frei), dann die Guardrails, gegen die
 * verteilt wird, die heutige Zuteilung je Wertstrom und zuletzt die Epics, die
 * fürs Budget-Meeting vorgemerkt sind — mit ihren Kosten, gegen den freien
 * Topf zu lesen. Die Runde selbst läuft in Budgeting; der Link führt hin.
 */
export function OverviewBudgeting({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  // Das Format des Horizont-Trichters darunter („2,1 Mio €") — dieselben
  // Beträge sollen gleich aussehen.
  const eur = (n: number) => formatScaledEUR(n, locale);
  // **Der Topf des Budget-Halbjahrs**, nicht die Summe aller Perioden
  // (`poolTotal`): verteilt wird in diesem Termin das eine Halbjahr. Und zwar
  // das des Budgets (`budgetCycleKey`), wie im Trichter darunter — der
  // Kalender-Schlüssel (`funding.currentPeriod`) kann davon abweichen und
  // dient nur als Rückfall.
  const topf =
    data.funding.periods.find((p) => p.key === data.budgetCycleKey) ?? data.funding.currentPeriod;
  return (
    <div className="space-y-6">
      <MeetingHeader meeting="participatory-budgeting" />

      <div className="space-y-2">
        <StatStrip className="flex-wrap">
          <Stat
            label={t("work.overview.kpiHalbjahr")}
            value={topf ? halfYearLabel(topf.key) : "—"}
          />
          <Stat label={t("work.overview.kpiTopfGesamt")} value={topf ? eur(topf.pool) : "—"} />
          <Stat
            label={t("work.overview.kpiTopfVerteilt")}
            value={topf ? eur(topf.allocated) : "—"}
          />
          <Stat label={t("work.overview.kpiTopfFrei")} value={topf ? eur(topf.remaining) : "—"} />
        </StatStrip>
        <p className="text-right text-sm">
          <Link href="/budgeting/periods" className="text-primary hover:underline">
            {t("work.overview.zuDenBudgetZeitraeumen")}
          </Link>
        </p>
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

      <FundingSnapshotTable data={data} />
      <BudgetCandidatesBlock data={data} />
    </div>
  );
}
