import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STICKY_THEAD } from "@/components/ui/table-chrome";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { STAGE_SHORT_KEYS } from "@/components/detail/initiative-labels";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";
import { isClassShown, rollUpBySolution } from "@/modules/work/domain/epic-class-filter";
import { rollupTone } from "@/modules/work/features/portfolio/overview/blocks/class-rollup";

/**
 * „Zur Steuerung markiert" — Tabelle der Initiativen (Epics) mit
 * `needsSteeringAttention` (fürs nächste Steering-Meeting vorgemerkt). Volle
 * Breite unter der Feature-Sektion; sortiert nach längster Zeit ohne Update
 * (Agenda-Reihenfolge). Server-only.
 *
 * Die zusammengefasste Klasse steht als **Fußzeile**, nicht als Zeile in der
 * Tabelle: deren Spalten — Stage Gate, Owner, Tage ohne Update — beschreiben ein
 * einzelnes Epic. Eine Sammelzeile ließe vier von fünf leer und sähe aus wie ein
 * Datenfehler.
 */
export function SteeringTableBlock({ data }: { data: PortfolioOverview }) {
  const t = useTranslations();
  const { classFilter } = data;
  const rows = data.steeringEpics.filter((r) => isClassShown(r.epicClass, classFilter.selected));
  const rollups = rollUpBySolution(
    data.steeringEpics.filter((r) => !isClassShown(r.epicClass, classFilter.selected)),
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("work.overview.zurSteuerungMarkiert")}</SectionLabel>
        {rows.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rollups.length > 0
            ? "In dieser Klasse ist nichts markiert."
            : "Keine Initiative für das nächste Steering-Meeting markiert."}
        </p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg bg-card shadow-card">
          <table className="w-full border-collapse text-xs">
            <thead className={STICKY_THEAD}>
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.titel")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.stageGate")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.owner")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("work.overview.wertstrom")}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("work.overview.tageSeitUpdate")}
                </th>
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
                  <td className="px-3 py-2 text-muted-foreground">
                    {t(STAGE_SHORT_KEYS[r.stageGate] ?? r.stageGate)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.ownerName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.valueStreamName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {r.daysSinceUpdate}
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
