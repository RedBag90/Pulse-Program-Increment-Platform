/**
 * Transformation delta — what changed between the two most recent snapshots.
 *
 * The trend sparkline shows the long-window movement; the cockpit "Seit
 * letztem Snapshot" drawer needs a *short* narrative ("Soll-Reife +5%",
 * "Ein neues Ziel erreicht") — the answer to "what did the last capture
 * actually move?". Pure: input is two snapshot rows, output is a small
 * ranked array of `RecentChange`. No queries, no formatting, no i18n.
 *
 * Why a domain helper and not just inline math in the page-model: the rules
 * for what counts as a meaningful delta (% threshold, count changes,
 * direction conventions) belong to the transformation concept, not the
 * presentation glue. Sibling of `transformation-snapshot`'s `computeSnapshotMetrics`.
 */

/** A single narrative entry for the cockpit's "Seit letztem Snapshot" list. */
export interface RecentChange {
  /** What kind of metric moved — drives the icon + label. */
  kind: "goal_achievement" | "structure_progress" | "achieved_goals" | "goal_count";
  /** Pre-i18n English label; the component decides how to localise it. */
  label: string;
  /**
   * The change. For `goal_achievement` / `structure_progress` it's a delta in
   * the 0..1 metric (multiply by 100 for display). For count kinds it's the
   * raw integer delta.
   */
  delta: number;
  direction: "up" | "down" | "flat";
}

/** Minimum %-point movement we consider "noteworthy" for the % metrics. */
const NOTABLE_PCT_DELTA = 0.01;

/** A snapshot as far as the delta cares. Subset of the Prisma row. */
export interface DeltaSnapshot {
  goalAchievement: number;
  structureProgress: number;
  goalCount: number;
  achievedGoalCount: number;
}

/**
 * Computes the ranked narrative entries between `previous` and `latest`.
 * Returns up to 4 entries, sorted by absolute magnitude. With fewer than two
 * snapshots the result is empty (the caller renders the empty state).
 *
 * Ordering: count changes that crossed zero (a goal newly achieved) outrank
 * percentage moves of similar visual weight, because the count is a
 * categorical event.
 */
export function recentChanges(
  previous: DeltaSnapshot | null,
  latest: DeltaSnapshot | null,
): RecentChange[] {
  if (!previous || !latest) return [];

  const out: RecentChange[] = [];

  const goalAchDelta = latest.goalAchievement - previous.goalAchievement;
  if (Math.abs(goalAchDelta) >= NOTABLE_PCT_DELTA) {
    out.push({
      kind: "goal_achievement",
      label: "Soll-Reife",
      delta: goalAchDelta,
      direction: goalAchDelta > 0 ? "up" : "down",
    });
  }

  const structDelta = latest.structureProgress - previous.structureProgress;
  if (Math.abs(structDelta) >= NOTABLE_PCT_DELTA) {
    out.push({
      kind: "structure_progress",
      label: "Strukturfortschritt",
      delta: structDelta,
      direction: structDelta > 0 ? "up" : "down",
    });
  }

  const achievedDelta = latest.achievedGoalCount - previous.achievedGoalCount;
  if (achievedDelta !== 0) {
    out.push({
      kind: "achieved_goals",
      label: "Erreichte Ziele",
      delta: achievedDelta,
      direction: achievedDelta > 0 ? "up" : "down",
    });
  }

  const countDelta = latest.goalCount - previous.goalCount;
  if (countDelta !== 0) {
    out.push({
      kind: "goal_count",
      label: "Anzahl Ziele",
      delta: countDelta,
      direction: countDelta > 0 ? "up" : "down",
    });
  }

  // Count changes (categorical events) sort above %-moves of equal magnitude.
  out.sort((a, b) => {
    const aWeight =
      a.kind === "achieved_goals" || a.kind === "goal_count"
        ? Math.abs(a.delta) + 1
        : Math.abs(a.delta);
    const bWeight =
      b.kind === "achieved_goals" || b.kind === "goal_count"
        ? Math.abs(b.delta) + 1
        : Math.abs(b.delta);
    return bWeight - aWeight;
  });

  return out.slice(0, 4);
}

/** RAG tier — a single 4-state band used uniformly on goal cards + chips. */
export type RagTier = "green" | "amber" | "red" | "done";

const GREEN_THRESHOLD = 0.7;
const AMBER_THRESHOLD = 0.3;

/**
 * Classifies a 0..1 value into a RAG tier. An explicit `done` short-circuits
 * everything else (a goal marked "achieved" is `done`, regardless of its KPI
 * progress — there might not even be KPIs).
 */
export function ragTier(value: number, achieved = false): RagTier {
  if (achieved) return "done";
  if (value >= GREEN_THRESHOLD) return "green";
  if (value >= AMBER_THRESHOLD) return "amber";
  return "red";
}
