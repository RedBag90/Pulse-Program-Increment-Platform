/**
 * Goal status model (Objectives + Key Results). Asana-style two-group set:
 *
 *   Open   — the goal is still being worked: on_track | at_risk | off_track
 *   Closed — the goal has been concluded:   achieved | partial | missed | dropped
 *
 * `null` status = no check-in yet → rendered as "No recent updates".
 *
 * Status is HYBRID: the system suggests an open status from progress
 * (`suggestOpenStatus`), the user may override, and a closed status is chosen
 * deliberately when closing the goal.
 */

export const OPEN_STATUSES = ["on_track", "at_risk", "off_track"] as const;
export const CLOSED_STATUSES = ["achieved", "partial", "missed", "dropped"] as const;

export type OpenStatus = (typeof OPEN_STATUSES)[number];
export type ClosedStatus = (typeof CLOSED_STATUSES)[number];
export type GoalStatus = OpenStatus | ClosedStatus;

/** All valid status values, in display order (Open group first). */
export const GOAL_STATUSES: readonly GoalStatus[] = [...OPEN_STATUSES, ...CLOSED_STATUSES];

const OPEN_SET: ReadonlySet<string> = new Set(OPEN_STATUSES);
const CLOSED_SET: ReadonlySet<string> = new Set(CLOSED_STATUSES);

export function isGoalStatus(s: string | null | undefined): s is GoalStatus {
  return s != null && (OPEN_SET.has(s) || CLOSED_SET.has(s));
}

export function isOpen(s: string | null | undefined): s is OpenStatus {
  return s != null && OPEN_SET.has(s);
}

export function isClosed(s: string | null | undefined): s is ClosedStatus {
  return s != null && CLOSED_SET.has(s);
}

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  achieved: "Achieved",
  partial: "Partial",
  missed: "Missed",
  dropped: "Dropped",
};

/** Label shown when a goal has no check-in yet. */
export const NO_STATUS_LABEL = "No recent updates";

/** Coarse colour tier driving the status pill / dot. */
export type GoalStatusTier = "green" | "amber" | "rose" | "neutral";

export const GOAL_STATUS_TIER: Record<GoalStatus, GoalStatusTier> = {
  on_track: "green",
  achieved: "green",
  at_risk: "amber",
  partial: "amber",
  off_track: "rose",
  missed: "rose",
  dropped: "neutral",
};

/** Tier for any status value or the no-status (null) case. */
export function goalStatusTier(s: string | null | undefined): GoalStatusTier {
  return isGoalStatus(s) ? GOAL_STATUS_TIER[s] : "neutral";
}

/** Human label for any status value or the no-status (null) case. */
export function goalStatusLabel(s: string | null | undefined): string {
  return isGoalStatus(s) ? GOAL_STATUS_LABELS[s] : NO_STATUS_LABEL;
}

/**
 * Auto-suggest the open status from a normalised progress value (0..1).
 * Thresholds mirror the legacy `statusForKr` heuristic in strategy-table-view:
 * ≥0.7 on track, >0 at risk, else off track.
 */
export function suggestOpenStatus(progress: number): OpenStatus {
  if (progress >= 0.7) return "on_track";
  if (progress > 0) return "at_risk";
  return "off_track";
}
