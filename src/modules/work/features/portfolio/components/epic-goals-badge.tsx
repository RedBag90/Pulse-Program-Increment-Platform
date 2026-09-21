import Link from "next/link";
import type { EpicGoalLinkRow } from "@/modules/core/goals/server/views/epic-goal-contributions";
import { SectionCard } from "@/components/ui/section-card";

/**
 * Cross-Modul-Goal-Badge (read-only, gepflegt im KPI-Tab): die per `GoalEpicLink`
 * (Einheiten-Kaskade) verknüpften Ziele dieses Epics — je Ziel die Umrechnung
 * „1 KPI-Einheit → x Ziel-Einheit" der gewählten KPI.
 *
 * **Sie war bis September 2026 eine handgerollte Karte** — eigenes
 * `rounded-lg bg-card p-4 shadow-card`, eigene `<h3>` — neben lauter
 * `SectionCard`s auf derselben Fläche. Genau davor warnt deren Docblock. Jetzt
 * ist sie eine von ihnen und trägt Kopf, Aktion und Hervorhebung ohne Sonderweg.
 */
interface Props {
  /** Einheiten-Kaskaden-Verknüpfungen (GoalEpicLink); leer/undefined = keine. */
  goalLinks?: EpicGoalLinkRow[];
  /**
   * Das Verknüpfen von Zielen gehört zum Reifegrad, auf dem das Epic steht.
   *
   * **Ist nichts verknüpft, rendert die Kachel gar nichts** — auf einem frischen
   * Epic ist sie also nicht bloss unmarkiert, sondern abwesend. Markiert wird,
   * was da ist.
   */
  atGate?: boolean;
}

export function EpicGoalsBadge({ goalLinks = [], atGate = false }: Props) {
  if (goalLinks.length === 0) return null;

  return (
    <SectionCard
      title="Strategische Beiträge"
      atGate={atGate}
      action={
        <Link
          href={"/ziele" as never}
          className="text-meta text-muted-foreground hover:text-foreground hover:underline"
        >
          → Ziele-Modul
        </Link>
      }
    >
      <ul className="space-y-1.5">
        {goalLinks.map((l) => (
          <li
            key={l.objectiveId}
            className="flex items-center gap-3 rounded-md border bg-muted/20 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.goalTitle}</p>
              <p className="truncate text-label text-muted-foreground">
                {l.kpiId && l.conversionFactor != null
                  ? `1 ${l.kpiUnit || "KPI-Einheit"} → ${l.conversionFactor.toLocaleString(
                      "de-DE",
                    )} ${l.goalUnit || ""}`
                  : "KPI / Faktor im KPI-Tab festlegen"}
              </p>
            </div>
            <Link
              href={`/ziele?entity=objective&id=${l.objectiveId}` as never}
              className="text-label text-muted-foreground hover:text-foreground hover:underline"
              title="Im Strategie-Modul oeffnen"
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
