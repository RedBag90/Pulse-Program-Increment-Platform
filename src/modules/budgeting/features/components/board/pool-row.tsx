"use client";

import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";
import type { Period } from "@/modules/budgeting/domain/period-window";
import { CELL_INPUT } from "@/modules/budgeting/features/components/board/board-cell";
import { AllocationBar } from "@/modules/budgeting/features/components/round/allocation-bar";
import { numOr0 } from "@/modules/budgeting/features/lib/allocation-payload";
import { Card } from "@/components/ui/card";

interface Props {
  periods: Period[];
  /** Eingabe-Stand als Strings (leer = kein Betrag). */
  pool: Record<string, string>;
  setPool: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  /** Topf − Σ Allokationen; negativ = Ueberallokation (REQ-B4). */
  remaining: PeriodAmounts;
  canManage: boolean;
  /** Editierbare Halbjahre (Rolling-Window); Rest read-only. */
  editableKeys: string[];
  /** Der Anker (aktiver Zyklus) — für die Spalten-Tönung. */
  activeCycleKey: string;
}

/**
 * Der Budget-Topf je Halbjahr plus die Auslastung (verteilt vs. Topf) als Balken.
 * Kontrolliert: der Editier-Stand lebt im Workspace, gespeichert wird zentral über
 * die Save-Bar. Perioden außerhalb des Rolling-Window sind read-only.
 */
export function PoolRow({ periods, pool, setPool, remaining, canManage, editableKeys, activeCycleKey }: Props) {
  const editable = new Set(editableKeys);

  return (
    <Card className="overflow-x-auto p-4" data-tour="budget-pool">
      <h2 className="mb-2 font-heading text-sm font-medium">Budget-Topf je Halbjahr</h2>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="w-40 py-1 pr-3 align-bottom text-muted-foreground">Budget</td>
            {periods.map((p) => (
              <td
                key={p.key}
                className={`px-1 py-1 text-right align-bottom ${p.key === activeCycleKey ? "bg-primary/5" : ""}`}
              >
                <input
                  className={CELL_INPUT}
                  inputMode="numeric"
                  value={pool[p.key] ?? ""}
                  disabled={!canManage || !editable.has(p.key)}
                  onChange={(e) => setPool((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  aria-label={`Budget ${p.label}`}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 pr-3 align-top text-muted-foreground">Auslastung</td>
            {periods.map((p) => {
              const budget = numOr0(pool[p.key] ?? "");
              const allocated = budget - (remaining[p.key] ?? 0);
              return (
                <td
                  key={p.key}
                  className={`px-2 py-2 align-top ${p.key === activeCycleKey ? "bg-primary/5" : ""}`}
                >
                  <AllocationBar allocated={allocated} budget={budget} />
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </Card>
  );
}
