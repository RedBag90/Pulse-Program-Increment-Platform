"use client";

import type { RagTier } from "@/domain/transformation-delta";
import type { GoalEditorView, UserOption } from "@/server/views/transformation-goals";

interface Props {
  goal: GoalEditorView;
  selected: boolean;
  userOptions: UserOption[];
  onSelect: (id: string) => void;
}

const TIER_DOT: Record<RagTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  done: "bg-emerald-600",
};

const TIER_BAR: Record<RagTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  done: "bg-emerald-600",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * One compact goal row in the left list. Replaces the old always-expanded
 * card with a scannable summary: RAG dot, title, owner, mini progress bar,
 * KPI + epic counts, due date. Clicking sets selection (via the parent's
 * `onSelect`, which pushes `?selected=g_<id>` onto the URL).
 */
export function GoalListRow({ goal, selected, userOptions, onSelect }: Props) {
  const owner = goal.ownerId ? userOptions.find((u) => u.id === goal.ownerId)?.label : null;
  const done = goal.status === "achieved";

  return (
    <button
      type="button"
      onClick={() => onSelect(goal.id)}
      className={`group w-full rounded-md border bg-card p-3 text-left transition-colors hover:bg-muted/50 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TIER_DOT[goal.tier]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{goal.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {owner ?? "ohne Owner"}
            {goal.dueDate ? ` · bis ${goal.dueDate}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {done ? "erreicht" : goal.kpis.length > 0 ? pct(goal.kpiProgress) : "—"}
        </span>
      </div>
      {!done && goal.kpis.length > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${TIER_BAR[goal.tier]}`}
            style={{ width: pct(goal.kpiProgress) }}
          />
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        {goal.kpis.length} KPI{goal.kpis.length !== 1 ? "s" : ""} · {goal.epics.length} Epic
        {goal.epics.length !== 1 ? "s" : ""}
      </p>
    </button>
  );
}
