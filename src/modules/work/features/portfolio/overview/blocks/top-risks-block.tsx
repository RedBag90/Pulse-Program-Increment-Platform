import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { ROAM_KEYS, ROAM_DOT } from "@/modules/core/kernel/domain/roam";
import { EXPOSURE_KEYS, EXPOSURE_TONE } from "@/modules/core/kernel/domain/exposure";
import type {
  OverviewRisk,
  PortfolioOverview,
} from "@/modules/work/server/views/portfolio-overview";

/** Wie viele kritische Risiken der Block zeigt, bevor er auf die Liste verweist. */
export const TOP_RISKS_LIMIT = 5;

/**
 * Die kritischen, noch nicht gelösten Risiken — nach Score, höchster zuerst.
 * Gelöst (`resolved`) ist nicht mehr akut; Owned, Accepted und Mitigated sind
 * eingeordnet, aber offen und bleiben stehen. Rein.
 */
export function criticalRisks(risks: readonly OverviewRisk[]): OverviewRisk[] {
  return risks
    .filter((r) => r.band === "critical" && r.roamStatus !== "resolved")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

/**
 * **Top-Risiken — die kritischen Risiken aus dem Issue-Register.**
 *
 * Bis September 2026 stand hier kein einziges Risiko aus dem Issue-Modul,
 * sondern drei Liefersignale aus Work (blockiertes Epic, stehendes Epic,
 * überfülltes Tor). Traf keines zu, meldete der Block „Keine akuten Risiken" —
 * während im Register kritische Risiken standen.
 *
 * Kritisch heisst: Exposure-Band `critical` (Score 16–25, ADR-0016). Die Daten
 * kommen aus dem Risks-Port der Seite (`data.risks`); ohne das Risiken-Modul
 * rendert die Ansicht den Block gar nicht. Das Band steht als Wort da, nicht
 * nur als Farbe (ADR-0021).
 */
export function TopRisksBlock({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const alle = criticalRisks(data.risks);
  const gezeigt = alle.slice(0, TOP_RISKS_LIMIT);
  const weitere = alle.length - gezeigt.length;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>{t("work.overview.topRisiken")}</SectionLabel>
        <span className="text-meta text-muted-foreground">
          {t("work.overview.topRisikenHinweis")}
        </span>
      </div>
      {gezeigt.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("work.overview.keineKritischenRisiken")}</p>
      ) : (
        <ul className="space-y-2.5">
          {gezeigt.map((r) => (
            <li key={r.id} className="space-y-0.5" data-risk={r.id}>
              <div className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-label font-medium ${EXPOSURE_TONE.critical.badge}`}
                  title={`Exposure: ${t(EXPOSURE_KEYS.critical)} (${r.score})`}
                >
                  {t(EXPOSURE_KEYS.critical)}
                </span>
                <Link
                  href={`/issues/${r.id}`}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {r.riskNumber != null && (
                    <span className="mr-1 font-mono text-muted-foreground">#{r.riskNumber}</span>
                  )}
                  {r.title}
                </Link>
              </div>
              <p className="flex flex-wrap items-center gap-x-2 pl-[3.25rem] text-meta text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className={`size-1.5 rounded-full ${ROAM_DOT[r.roamStatus]}`} />
                  {t(ROAM_KEYS[r.roamStatus])}
                </span>
                {r.epic && (
                  <Link href={`/portfolio/epics/${r.epic.id}`} className="truncate hover:underline">
                    {r.epic.title}
                  </Link>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {weitere > 0 && (
        <p className="text-sm">
          <Link href="/issues" className="text-primary hover:underline">
            {t("work.overview.weitereKritischeRisiken", { count: weitere })}
          </Link>
        </p>
      )}
    </Card>
  );
}
