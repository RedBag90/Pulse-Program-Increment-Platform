import { goalStatusLabel, goalStatusTier, type GoalStatusTier } from "@/modules/core/goals/domain/goal-status";

const PILL_CLS: Record<GoalStatusTier, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground",
};

const DOT_CLS: Record<GoalStatusTier, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  neutral: "bg-slate-400",
};

/**
 * Status pill for a goal (Objective or Key Result). Renders any GoalStatus
 * value, or the "No recent updates" state when `status` is null.
 */
export function GoalStatusPill({ status }: { status: string | null | undefined }) {
  const tier = goalStatusTier(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL_CLS[tier]}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${DOT_CLS[tier]}`} />
      {goalStatusLabel(status)}
    </span>
  );
}
