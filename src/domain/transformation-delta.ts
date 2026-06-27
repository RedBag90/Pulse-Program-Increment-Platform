/**
 * Transformation cockpit's RAG-tier band, shared by goal cards + chips. Lives
 * here historically alongside a `recentChanges()` ranked-narrative helper —
 * that function was thoroughly unit-tested but never wired to a page-model
 * (the planned "Seit letztem Snapshot" drawer didn't ship). It was deleted
 * with its tests after the 2026-06-27 architecture review; if the drawer
 * ever materialises, re-derive the rules from the deltas you actually need.
 */

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
