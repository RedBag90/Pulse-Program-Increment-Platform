import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import { STAGE_SHORT_KEYS } from "@/components/detail/initiative-labels";
import { formatScaledEUR } from "@/lib/formatting";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { EPIC_CLASS_KEYS } from "@/modules/work/domain/pb-submission";
import { isClassShown } from "@/modules/work/domain/epic-class-filter";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

/**
 * **Kandidaten fürs Budget-Meeting** — die Epics mit „Fürs nächste
 * Budget-Meeting vormerken", nach Horizont, darin die teuersten zuerst.
 *
 * Die Marke setzt man am Epic; sie ist zugleich die Voraussetzung, als
 * Kandidat in eine Budget-Runde zu kommen. Hier steht, worüber im
 * Participatory Budgeting gesprochen wird — die Kosten aus dem Business Case,
 * damit die Summe gegen den freien Topf gelesen werden kann.
 */
export function BudgetCandidatesBlock({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const rows = data.budgetCandidates.filter((r) =>
    isClassShown(r.epicClass, data.classFilter.selected),
  );
  const summe = rows.reduce((s, r) => s + (r.cost ?? 0), 0);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>{t("work.overview.budgetKandidaten")}</SectionLabel>
        {rows.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {t("work.overview.budgetKandidatenSumme", {
              count: rows.length,
              amount: formatScaledEUR(summe, locale),
            })}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("work.overview.keineBudgetKandidaten")}</p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg bg-card shadow-card">
          <table className="w-full border-collapse text-xs">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.titel")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.horizont")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.klasse")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.stageGate")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.wertstrom")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("work.overview.kosten")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <Link
                      href={`/portfolio/epics/${r.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {r.horizon ? <HorizonBadge horizon={r.horizon} short /> : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.epicClass ? t(EPIC_CLASS_KEYS[r.epicClass]) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {t(STAGE_SHORT_KEYS[r.stageGate] ?? r.stageGate)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.cost == null ? (
                      <span className="text-muted-foreground">
                        {t("work.overview.ohneBusinessCase")}
                      </span>
                    ) : (
                      formatScaledEUR(r.cost, locale)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
