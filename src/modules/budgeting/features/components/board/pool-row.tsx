"use client";

import { useActionState, startTransition } from "react";
import { saveBudgetPoolAction } from "@/modules/budgeting/features/actions/budgeting";
import {
  numOr0,
  encodeSaveBudgetPoolPayload,
} from "@/modules/budgeting/features/lib/allocation-payload";
import type { PeriodAmounts } from "@/modules/budgeting/domain/period-map";
import type { Period } from "@/modules/budgeting/domain/period-window";
import { CELL_INPUT } from "@/modules/budgeting/features/components/board/board-cell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/formatting";

interface Props {
  periods: Period[];
  /** Eingabe-Stand als Strings (leer = kein Betrag). */
  pool: Record<string, string>;
  setPool: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  /** Topf − Σ Allokationen; negativ wird als Ueberallokation markiert (REQ-B4). */
  remaining: PeriodAmounts;
  canManage: boolean;
}

/** Der Budget-Topf je Halbjahr plus die Verbleibend-Zeile darunter. */
export function PoolRow({ periods, pool, setPool, remaining, canManage }: Props) {
  const [state, save, pending] = useActionState(saveBudgetPoolAction, {});

  function submit() {
    const byPeriod: Record<string, number> = {};
    for (const p of periods) {
      const n = numOr0(pool[p.key] ?? "");
      if (n > 0) byPeriod[p.key] = n;
    }
    startTransition(() => save(encodeSaveBudgetPoolPayload({ byPeriod })));
  }

  return (
    <Card className="overflow-x-auto p-4" data-tour="budget-pool">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-medium">Budget-Topf je Halbjahr</h2>
        {canManage && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={submit}>
            {pending ? "Speichert…" : "Topf speichern"}
          </Button>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="w-40 py-1 pr-3 text-muted-foreground">Budget</td>
            {periods.map((p) => (
              <td key={p.key} className="px-1 py-1 text-right">
                <input
                  className={CELL_INPUT}
                  inputMode="numeric"
                  value={pool[p.key] ?? ""}
                  disabled={!canManage}
                  onChange={(e) => setPool((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  aria-label={`Budget ${p.label}`}
                />
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-1 pr-3 text-muted-foreground">Verbleibend</td>
            {periods.map((p) => {
              const r = remaining[p.key] ?? 0;
              return (
                <td
                  key={p.key}
                  className={`px-2 py-1 text-right tabular-nums ${r < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {formatEUR(r)}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
    </Card>
  );
}
