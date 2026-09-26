import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { isClassShown, rollUpBySolution } from "@/modules/work/domain/epic-class-filter";
import { rollupTone } from "@/modules/work/features/portfolio/overview/blocks/class-rollup";

/**
 * **Beantragte Entscheidungen** — Epics mit offenem Antrag auf die
 * Analyse-Auswahl oder die Business-Case-Freigabe.
 *
 * Steht direkt unter „Zur Steuerung markiert" und ist deren Gegenstück: dort
 * stehen Epics, die ein Mensch fürs Steering vorgemerkt hat; hier die, bei
 * denen eine Entscheidung tatsächlich ansteht. Bis September 2026 vermischte
 * sich beides — der Reifegrad-Wechsel setzte das Steering-Flag automatisch.
 *
 * Aufbau wie `SteeringTableBlock`, damit beide Kacheln sich lesen wie eine
 * Agenda in zwei Teilen. Server-only.
 */
/** Der Antrag in Worten — was beantragt ist, nicht was erreicht wäre. */
const ANTRAG_KEYS = {
  analysis: "work.overview.antragAnalyse",
  L2: "work.overview.antragBusinessCase",
} as const;

export function RequestedDecisionsBlock({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const { classFilter } = data;
  const rows = data.requestedDecisionEpics.filter((r) =>
    isClassShown(r.epicClass, classFilter.selected),
  );
  const rollups = rollUpBySolution(
    data.requestedDecisionEpics.filter((r) => !isClassShown(r.epicClass, classFilter.selected)),
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("work.overview.beantragteEntscheidungen")}</SectionLabel>
        {rows.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rollups.length > 0
            ? t("work.overview.inDieserKlasseKeinAntrag")
            : t("work.overview.keineOffenenAntraege")}
        </p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg bg-card shadow-card">
          <table className="w-full border-collapse text-xs">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.titel")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.antrag")}</th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("work.overview.beantragtVon")}
                </th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.wertstrom")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("work.overview.abnahmen")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("work.overview.tageOffen")}</th>
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
                  <td className="px-3 py-2 text-muted-foreground">{t(ANTRAG_KEYS[r.step])}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.requestedByName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.approvalsDone} / {r.approvalsTotal}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.daysWaiting}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rollups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
          <span className="text-xs text-muted-foreground">
            {t("work.overview.notInTable")} ·{" "}
            {classFilter.hiddenLabelKey && t(classFilter.hiddenLabelKey)}:
          </span>
          {rollups.map((r) => (
            <span
              key={r.solutionId ?? "none"}
              className={`inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium ${rollupTone(
                classFilter.hiddenClass,
              )}`}
            >
              {r.name}
              <span className="font-mono tabular-nums opacity-80">{r.count}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
