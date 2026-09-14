import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";

/**
 * Die sechs Spalten des Portfolio-Kanbans — und die Besonderheit, um die es in
 * dieser Phase geht: **Funnel und Hypothese tragen denselben Reifegrad.**
 *
 * Die Spalten kommen aus `STAGE_GATES` und ihre Namen aus `STAGE_SHORT`, also
 * aus denselben zwei Konstanten, aus denen das Kanban selbst sie nimmt. Die
 * Ausnahme steht als Fussnote daneben statt als vierte Spalte in der Tabelle —
 * sie gilt fuer genau eine Kante und soll nicht aussehen wie eine Regel.
 */
export function KanbanColumns() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg bg-card shadow-card">
        <div className="flex min-w-[520px] divide-x">
          {STAGE_GATES.map((g) => (
            <div key={g} className="flex-1 px-3 py-3 text-center">
              <p className="font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
                {g === "L1" ? "L0" : g}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">{STAGE_SHORT[g]}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="max-w-[var(--reading-max-w)] text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">Die zweite Spalte ist die Ausnahme.</strong>{" "}
        Sie heisst <em>Hypothese</em>, trägt aber weiterhin den Reifegrad <code>L0</code>. Was ein
        Epic dorthin bewegt, ist kein Tor, sondern ein Stempel: die erste Benennung eines Epic
        Owners.
      </p>
    </div>
  );
}
