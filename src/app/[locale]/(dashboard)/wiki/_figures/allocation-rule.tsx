import { GATE_STEPS, gateStepNumber } from "@/modules/work/domain/stage-gate";
import {
  mayHoldAllocation,
  requiresCurrentAllocation,
} from "@/modules/budgeting/domain/allocation-eligibility";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";

/**
 * **Wer darf Budget tragen — und wer muss?**
 *
 * Beide Spalten kommen aus den zwei Praedikaten selbst, nicht aus einer
 * abgeschriebenen Tabelle. Das ist hier mehr als Hygiene: die Regel stand
 * einmal an drei Stellen in drei Fassungen, bevor sie in
 * `allocation-eligibility.ts` versammelt wurde. Eine vierte Fassung im Wiki
 * waere der Rueckfall gewesen.
 */
export function AllocationRule() {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[440px] border-collapse text-sm">
        <thead>
          <tr>
            {["Schritt", "Kanban-Spalte", "Darf Budget tragen", "Muss Budget haben"].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GATE_STEPS.map((g) => {
            const may = mayHoldAllocation(g);
            const must = requiresCurrentAllocation(g);
            return (
              <tr key={g}>
                <td className="border-b border-border/60 px-4 py-2 font-mono text-[12.5px] text-foreground">
                  {gateStepNumber(g)}
                </td>
                <td className="border-b border-border/60 px-4 py-2 text-muted-foreground">
                  {STAGE_SHORT[g] ?? "—"}
                </td>
                <td className="border-b border-border/60 px-4 py-2">
                  {may ? (
                    <span className="font-medium text-foreground">ja</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="border-b border-border/60 px-4 py-2">
                  {must ? (
                    <span className="font-medium text-foreground">ja</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
