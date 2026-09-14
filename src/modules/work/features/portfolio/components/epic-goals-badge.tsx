import Link from "next/link";
import type { EpicGoalLinkRow } from "@/modules/core/goals/server/views/epic-goal-contributions";

/**
 * Cross-Modul-Goal-Badge (read-only, gepflegt im KPI-Tab): die per `GoalEpicLink`
 * (Einheiten-Kaskade) verknüpften Ziele dieses Epics — je Ziel die Umrechnung
 * „1 KPI-Einheit → x Ziel-Einheit" der gewählten KPI.
 */
interface Props {
  /** Einheiten-Kaskaden-Verknüpfungen (GoalEpicLink); leer/undefined = keine. */
  goalLinks?: EpicGoalLinkRow[];
}

export function EpicGoalsBadge({ goalLinks = [] }: Props) {
  if (goalLinks.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg bg-card p-4 shadow-card">
      <header className="flex items-baseline justify-between">
        <h3 className="text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Strategische Beitraege
        </h3>
        <Link
          href={"/ziele" as never}
          className="text-meta text-muted-foreground hover:text-foreground hover:underline"
        >
          → Ziele-Modul
        </Link>
      </header>

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
    </section>
  );
}
