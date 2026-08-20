"use client";

import { Card } from "@/components/ui/card";
import { PoolRow } from "@/modules/budgeting/features/components/board/pool-row";
import { EpicRow } from "@/modules/budgeting/features/components/board/epic-row";
import type { BudgetEpicView } from "@/modules/budgeting/domain/budgeting";
import type { BudgetingBoardModel } from "@/modules/budgeting/server/views/budgeting-board";

interface Props {
  /** Live-abgeleitetes Board-Modell (Bedarf, Verbleibend, Rollup). */
  model: BudgetingBoardModel;
  pool: Record<string, string>;
  setPool: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onEpicChange: (next: BudgetEpicView) => void;
  canManage: boolean;
}

/**
 * Ebene „Topf & Epics" — kontrollierte Präsentation: Topf-Zeile + Epic-Tabelle.
 * Hält keinen eigenen State; Editier-Stand und Speichern liegen im Workspace.
 */
export function LevelPool({ model, pool, setPool, onEpicChange, canManage }: Props) {
  const activeCycleKey = model.activeCycleKey;
  return (
    <div className="space-y-6">
      <PoolRow
        periods={model.periods}
        pool={pool}
        setPool={setPool}
        remaining={model.remaining}
        canManage={canManage}
        editableKeys={model.editableKeys}
        activeCycleKey={activeCycleKey}
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Epic</th>
              <th className="p-3 text-center font-medium">Prio</th>
              <th className="p-3 font-medium">Bedarf ab</th>
              {model.periods.map((p) => (
                <th
                  key={p.key}
                  className={`p-3 text-right font-medium ${p.key === activeCycleKey ? "bg-primary/5" : ""}`}
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <EpicRow
                key={row.epic.id}
                row={row}
                periods={model.periods}
                canManage={canManage}
                onChange={onEpicChange}
                editableKeys={model.editableKeys}
                activeCycleKey={activeCycleKey}
              />
            ))}
            {model.rows.length === 0 && (
              <tr>
                <td colSpan={model.periods.length + 3} className="p-6 text-center text-muted-foreground">
                  Keine vorgemerkten Epics mit freigegebener Hypothese oder freigegebenem Business
                  Case.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
