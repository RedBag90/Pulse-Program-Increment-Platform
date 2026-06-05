"use client";

import { useActionState, useEffect } from "react";
import { Link2 } from "lucide-react";
import { saveTargetOutcomeAction } from "@/features/transformation/actions/target-outcome";
import { Label } from "@/components/ui/label";
import { KpiEditorRow } from "@/features/transformation/components/kpi-editor-row";
import type { KpiEditorData, GoalEditorView } from "@/server/views/transformation-goals";

interface Props {
  kpi: KpiEditorData;
  /** All non-archived goals — destination options for "Einem Ziel zuordnen". */
  goals: GoalEditorView[];
  canManage: boolean;
  /** Called after a successful "assign to goal" so the shell can re-select the parent. */
  onAssigned?: (goalId: string) => void;
  /** Called after the KPI is deleted from the editor row. */
  onDeleted?: () => void;
}

const SELECT =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Right pane when an unbound KPI is selected. Surfaces two things:
 *
 * 1. **"Einem Ziel zuordnen"** select at the top — calls
 *    `saveTargetOutcomeAction` with `goalId` set; the same action that
 *    updates the KPI elsewhere just happens to flip the parent here, so no
 *    new server code is needed.
 * 2. **Full KPI editor** below (reusing `<KpiEditorRow>`) — same in-place
 *    field editing as the bound KPI rows on a goal detail pane.
 */
export function UnboundKpiDetailPane({ kpi, goals, canManage, onAssigned, onDeleted }: Props) {
  const [assignState, assign, assigning] = useActionState(saveTargetOutcomeAction, {});

  useEffect(() => {
    if (assignState.success && assignState.warnings === undefined && onAssigned) {
      // We can't read the chosen goalId back from the action state directly;
      // the shell handles re-selection by listening for the URL to change
      // after the page revalidates. As a defensive fallback the parent
      // also gets `onAssigned("")` so it can refetch / clear selection.
      onAssigned("");
    }
  }, [assignState.success, assignState.warnings, onAssigned]);

  function assignToGoal(goalId: string) {
    if (goalId === "") return;
    const payload = {
      id: kpi.id,
      goalId,
      title: kpi.title,
      metricUnit: kpi.metricUnit,
      baseline: kpi.baseline,
      target: kpi.target,
      current: kpi.current,
      dueDate: kpi.dueDate,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    assign(fd);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ungebundene KPI</p>
        <p className="text-sm">
          Diese KPI ist (noch) keinem strategischen Ziel zugeordnet — sie zählt im Cockpit nicht zur
          Soll-Reife. Über das untenstehende Feld kannst du sie einem Ziel zuordnen.
        </p>
        {canManage && (
          <div className="space-y-1.5">
            <Label htmlFor="ukpi-assign" className="text-xs">
              Einem Ziel zuordnen
            </Label>
            <div className="flex items-center gap-2">
              <Link2 className="size-3.5 text-muted-foreground" aria-hidden />
              <select
                id="ukpi-assign"
                className={`${SELECT} h-9 flex-1`}
                defaultValue=""
                onChange={(e) => assignToGoal(e.target.value)}
                disabled={assigning}
              >
                <option value="" disabled>
                  — Ziel wählen —
                </option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            {assignState.error && (
              <p role="alert" className="text-xs text-destructive">
                {assignState.error}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-heading text-sm font-medium">KPI bearbeiten</h2>
        <KpiEditorRow kpi={kpi} goalId={null} canManage={canManage} onDeleted={onDeleted} />
      </section>
    </div>
  );
}
