"use client";

import { useMemo, useState } from "react";
import {
  buildBudgetingBoardModel,
  type BudgetingBoardModel,
} from "@/modules/budgeting/server/views/budgeting-board";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import { numOr0 } from "@/modules/budgeting/features/lib/allocation-payload";
import { Card } from "@/components/ui/card";
import { PoolRow } from "@/modules/budgeting/features/components/board/pool-row";
import { EpicRow } from "@/modules/budgeting/features/components/board/epic-row";
import { ValueStreamChart } from "@/modules/budgeting/features/components/board/value-stream-chart";

interface Props {
  /** Vorberechnetes Server-Modell — der Ausgangsstand des Boards. */
  model: BudgetingBoardModel;
  canManage: boolean;
}

/**
 * Participatory-Budgeting-Board. Die Komponente hält nur noch den **Editier-
 * Stand** (Topf-Eingaben als Strings, die live bearbeiteten Epics); jede
 * Ableitung — Bedarf, Verbleibend, Wertstrom-Roll-up, Chart-Zeilen — kommt aus
 * `buildBudgetingBoardModel`, derselben reinen Funktion, die der Server benutzt.
 * Vorher standen diese fünf Ableitungen hier als eigene `useMemo`-Kette.
 */
export function BudgetingBoard({ model: initial, canManage }: Props) {
  const [pool, setPool] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of initial.periods) {
      init[p.key] = initial.pool[p.key] != null ? String(initial.pool[p.key]) : "";
    }
    return init;
  });
  const [epics, setEpics] = useState<BudgetEpicView[]>(() => initial.rows.map((r) => r.epic));

  // Live-Neuberechnung nach genau der Server-Regel — keine zweite Ableitung.
  const model = useMemo(() => {
    const poolNumbers: Record<string, number> = {};
    for (const [k, v] of Object.entries(pool)) poolNumbers[k] = numOr0(v);
    return buildBudgetingBoardModel({ epics, axis: initial.axis, pool: poolNumbers });
  }, [epics, pool, initial.axis]);

  return (
    <div className="space-y-6">
      <PoolRow
        periods={model.periods}
        pool={pool}
        setPool={setPool}
        remaining={model.remaining}
        canManage={canManage}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Epic</th>
              <th className="p-3 text-center font-medium">Prio</th>
              <th className="p-3 font-medium">Bedarf ab</th>
              {model.periods.map((p) => (
                <th key={p.key} className="p-3 text-right font-medium">
                  {p.label}
                </th>
              ))}
              {canManage && <th className="p-3" />}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <EpicRow
                key={row.epic.id}
                row={row}
                periods={model.periods}
                canManage={canManage}
                onChange={(next) =>
                  setEpics((prev) => prev.map((e) => (e.id === next.id ? next : e)))
                }
              />
            ))}
            {model.rows.length === 0 && (
              <tr>
                <td
                  colSpan={model.periods.length + 4}
                  className="p-6 text-center text-muted-foreground"
                >
                  Keine vorgemerkten Epics mit freigegebener Hypothese oder freigegebenem Business
                  Case.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <ValueStreamChart rollup={model.rollup} chartRows={model.chartRows} />
    </div>
  );
}
