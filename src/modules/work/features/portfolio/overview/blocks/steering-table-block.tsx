import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";
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
  const { classFilter } = data;
  const rows = data.steeringEpics.filter((r) => isClassShown(r.epicClass, classFilter.selected));
  const rollups = rollUpBySolution(
    data.steeringEpics.filter((r) => !isClassShown(r.epicClass, classFilter.selected)),
  );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Zur Steuerung markiert</SectionLabel>
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
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Titel</th>
                <th className="px-3 py-2 text-left font-medium">Stage Gate</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Owner</th>
                <th className="px-3 py-2 text-left font-medium">Wertstrom</th>
                <th className="px-3 py-2 text-right font-medium">Tage seit Update</th>
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
                  <td className="px-3 py-2 text-muted-foreground">{STAGE_SHORT[r.stageGate]}</td>
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
            Nicht in der Tabelle · {classFilter.hiddenLabel}:
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
