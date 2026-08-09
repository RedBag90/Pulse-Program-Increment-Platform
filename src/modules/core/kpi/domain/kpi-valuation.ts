/**
 * Finance valuation of a KPI's movement — pure, no I/O.
 *
 * One number, both readings: the Finance Controller stores a `valuePerUnit`
 * in the KPI's natural unit (e.g. € per day saved, € per +1 % NPS gained).
 * `kpiValueContribution` then yields the € value of the current movement, and
 * `eurPerPercentagePoint` gives the equivalent "€ per 1 % of target gap" for
 * display — they are mathematically equivalent for the same input.
 *
 * Direction is encoded by the *sign* of (target − baseline): the user enters
 * `baseline` at "today" and `target` at "the goal", so lead-time (10 → 6) and
 * NPS (40 → 80) both work without a separate direction flag — same convention
 * as the canonical `kpi-direction.ts` helpers.
 */

import { fulfillmentFraction } from "@/modules/core/kpi/domain/kpi-direction";

export interface KpiPoint {
  baseline: number | null;
  target: number | null;
  current: number | null;
}

export interface KpiValuationInput extends KpiPoint {
  valuePerUnit: number | null;
}

/** +1 when higher is better, −1 when lower is better, 0 when the band has no width. */
export function direction(baseline: number | null, target: number | null): -1 | 0 | 1 {
  if (baseline == null || target == null) return 0;
  if (target > baseline) return 1;
  if (target < baseline) return -1;
  return 0;
}

/**
 * Signed improvement *toward target*, in natural units. Positive = improving,
 * negative = regressing, 0 when at baseline or any field is missing.
 *
 * Works for both higher- and lower-is-better via the baseline→target direction
 * (lead-time `baseline=10, target=6, current=8` ⇒ +2 days saved).
 */
export function kpiDelta({ baseline, target, current }: KpiPoint): number {
  if (baseline == null || target == null || current == null) return 0;
  return (current - baseline) * direction(baseline, target);
}

/**
 * € value of the current movement = signed improvement × € per unit. Returns
 * `null` when there is nothing to value (missing valuation or missing reading).
 */
export function kpiValueContribution(input: KpiValuationInput): number | null {
  if (input.valuePerUnit == null) return null;
  if (input.current == null || input.baseline == null || input.target == null) return null;
  return kpiDelta(input) * input.valuePerUnit;
}

/**
 * Fulfilment as a fraction of the target gap, 0..∞. Sign-aware via
 * baseline→target (see `kpi-direction.ts`). Returns `null` when fields are
 * missing or the band has no width.
 */
export function percentOfTargetGap({ baseline, target, current }: KpiPoint): number | null {
  return fulfillmentFraction(baseline, target, current);
}

/**
 * The equivalent "€ per 1 percentage-point of target gap closed" for display
 * next to the per-unit valuation. By construction:
 *   €/unit × |target − baseline| / 100 = €/pp
 * so entering either value yields the same contribution.
 */
export function eurPerPercentagePoint({
  baseline,
  target,
  valuePerUnit,
}: {
  baseline: number | null;
  target: number | null;
  valuePerUnit: number | null;
}): number | null {
  if (valuePerUnit == null || baseline == null || target == null) return null;
  return (Math.abs(target - baseline) * valuePerUnit) / 100;
}
