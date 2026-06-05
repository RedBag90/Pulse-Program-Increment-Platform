"use client";

import { Target } from "lucide-react";
import { GoalListRow } from "@/features/transformation/components/goal-list-row";
import { UnboundKpiListRow } from "@/features/transformation/components/unbound-kpi-list-row";
import type {
  GoalEditorView,
  KpiEditorData,
  UserOption,
} from "@/server/views/transformation-goals";
import type { Selection } from "@/features/transformation/components/goals-selection";

interface Props {
  goals: GoalEditorView[];
  unboundKpis: KpiEditorData[];
  /** Show the "Ohne Ziel" group? Hidden when filtering to a non-active status. */
  showUnbound: boolean;
  userOptions: UserOption[];
  selection: Selection;
  onSelectGoal: (id: string) => void;
  onSelectKpi: (id: string) => void;
}

/**
 * Left column of the strategic-goals page. Renders the filtered goal list
 * plus the "Ohne Ziel" group of unbound KPIs at the bottom (only when the
 * status filter is active OR alle — there's no concept of an archived
 * unbound KPI, so other filters hide the group entirely). Empty state
 * appears when both lists are empty after filtering.
 */
export function GoalList({
  goals,
  unboundKpis,
  showUnbound,
  userOptions,
  selection,
  onSelectGoal,
  onSelectKpi,
}: Props) {
  const empty = goals.length === 0 && (!showUnbound || unboundKpis.length === 0);
  if (empty) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Target className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Keine Ziele gefunden — Filter anpassen oder ein neues Ziel anlegen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goals.length > 0 && (
        <ul className="space-y-2">
          {goals.map((g) => (
            <li key={g.id}>
              <GoalListRow
                goal={g}
                userOptions={userOptions}
                selected={selection.kind === "goal" && selection.id === g.id}
                onSelect={onSelectGoal}
              />
            </li>
          ))}
        </ul>
      )}

      {showUnbound && unboundKpis.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Ohne Ziel
          </p>
          <ul className="space-y-2">
            {unboundKpis.map((k) => (
              <li key={k.id}>
                <UnboundKpiListRow
                  kpi={k}
                  selected={selection.kind === "kpi" && selection.id === k.id}
                  onSelect={onSelectKpi}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
