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
import { benefitKindOrDefault } from "@/modules/core/kpi/domain/kpi-benefit-kind";
import { recurringIntervalOrDefault } from "@/modules/core/kpi/domain/kpi-recurring-interval";

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
 * Single-KPI **attainment** fraction, CLAMPED to [0, 1]. Sign-aware via
 * baseline→target (see `percentOfTargetGap`). Returns `null` when a field is
 * missing, the current reading is null, or the band has no width — "no data"
 * is deliberately *not* folded into "0 %".
 */
export function kpiAttainment(kpi: KpiPoint): number | null {
  const f = percentOfTargetGap(kpi);
  return f == null ? null : Math.min(1, Math.max(0, f));
}

/**
 * Mean single-KPI attainment across the KPIs that actually have a reading —
 * KPIs whose {@link kpiAttainment} is `null` (missing field / null current /
 * zero-width band) are **excluded** from both numerator and denominator
 * (product policy: "no data" ≠ "0 %"). Returns `null` when none qualify.
 */
export function kpiFulfillmentMean(kpis: KpiPoint[]): number | null {
  const vals: number[] = [];
  for (const k of kpis) {
    const a = kpiAttainment(k);
    if (a != null) vals.push(a);
  }
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/**
 * Raw calculatoric € total of a KPI at 100 % target: `|target − baseline| ×
 * valuePerUnit`. Returns `null` when any field is missing. This is the display
 * "≈ € Nutzen" figure — no one-time/recurring annualisation (see {@link kpiPlanned}).
 */
export function kpiPlannedAtTarget(kpi: {
  baseline: number | null;
  target: number | null;
  valuePerUnit: number | null;
}): number | null {
  if (kpi.valuePerUnit == null || kpi.baseline == null || kpi.target == null) return null;
  return Math.abs(kpi.target - kpi.baseline) * kpi.valuePerUnit;
}

/**
 * Planned € of a KPI at 100 % target, one-time vs. recurring-annualised — the
 * single source of the formula previously duplicated in `epic-economics.ts`
 * and `lpm-review.ts`. One-time → the raw base; recurring → base (yearly) or
 * base × 12 (monthly). Any missing field or a zero-width base → 0.
 */
export function kpiPlanned(kpi: {
  baseline: number | null;
  target: number | null;
  valuePerUnit: number | null;
  benefitKind: string;
  recurringInterval: string;
}): number {
  if (kpi.valuePerUnit == null || kpi.baseline == null || kpi.target == null) return 0;
  const base = Math.abs(kpi.target - kpi.baseline) * kpi.valuePerUnit;
  if (base === 0) return 0;
  if (benefitKindOrDefault(kpi.benefitKind) === "one_time") return base;
  return recurringIntervalOrDefault(kpi.recurringInterval) === "monthly" ? base * 12 : base;
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
