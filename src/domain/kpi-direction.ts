/**
 * KPI direction — the "lead-time vs NPS" convention encoded once.
 *
 * Direction is implicit in the **sign of `(target − baseline)`**: lead-time
 * (10 → 6) and NPS (40 → 80) work without a separate flag because the
 * denominator carries the sign. This was inlined in three places before:
 * `kpi-valuation.ts::percentOfTargetGap`, `goals-rollup.ts::kpiAchievement`
 * + `kpiContributionDetail`, and `portfolio-economics.ts::kpiFulfillmentByMonth`.
 *
 * Two canonical functions live here; each consumer picks the one that matches
 * its edge-case semantics:
 *  - `fulfillmentFraction` — raw, unclamped, `null` on missing input *or*
 *    zero-width band. Used by display / rollup math that wants to react to
 *    missing data (badges, € rollups).
 *  - `saturatedFulfillment` — saturation-style for forecast math: missing
 *    measurement reads as 0, zero-width band with a measurement reads as 1
 *    (full), and negatives clamp to 0. Used by recurring-benefit factoring.
 */

/**
 * Signed fraction `(current − baseline) / (target − baseline)`, unclamped.
 * Returns `null` if any input is missing or the band has no width.
 */
export function fulfillmentFraction(
  baseline: number | null,
  target: number | null,
  current: number | null,
): number | null {
  if (baseline == null || target == null || current == null) return null;
  const denom = target - baseline;
  if (denom === 0) return null;
  return (current - baseline) / denom;
}

/**
 * Saturation-style fulfilment: missing measurement → 0; zero-width band with
 * a measurement → 1; negatives clamp to 0; upper end is **not** clamped
 * (over-achievement allowed). Matches the snapshot semantics of the per-month
 * recurring-benefit factor.
 */
export function saturatedFulfillment(
  baseline: number | null,
  target: number | null,
  current: number | null,
): number {
  if (current == null) return 0;
  if (baseline == null || target == null) return 0;
  const denom = target - baseline;
  if (denom === 0) return 1;
  return Math.max(0, (current - baseline) / denom);
}
