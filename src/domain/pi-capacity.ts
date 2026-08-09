/**
 * PI Planning capacity overlay — pure derivations that turn the ART budget +
 * Feature-side WSJF Job Size data into per-PI demand/capacity badges, in two
 * units side-by-side: WSJF Job Size (the only Feature-level "size" proxy)
 * and Euro (the budget axis).
 *
 * No I/O. Pairs with `pi-planning` view builder and the column header on the
 * PI-Planning board. Capacity in € is either an explicit per-PI override or
 * auto-prorated from the ART budget's half-year cells.
 */

import { halfYearKey, halfYearStart, addHalfYears } from "@/modules/core/kernel/domain/calendar";

export interface PiWindow {
  id: string;
  startDate: Date;
  endDate: Date;
  /** Explicit overrides; null means "fall back to derivation / unlimited". */
  capacityJobSize: number | null;
  capacityAmount: number | null;
}

export interface PiCapacity {
  piId: string;
  capacityJobSize: number | null;
  capacityAmount: number | null;
  /** "override" if `capacityAmount` was set by hand; "prorated" if computed from the ART budget. */
  capacityAmountSource: "override" | "prorated" | null;
}

export interface FeatureForDemand {
  piId: string | null;
  wsjfJobSize: number | null;
}

export interface PiDemand {
  piId: string;
  jobSizeSum: number;
  /** `null` when the tenant has no €/Job-Size conversion configured. */
  amountSum: number | null;
  featureCount: number;
}

export type UtilizationBand = "ok" | "warn" | "over";

const MS_PER_DAY = 86_400_000;

/** Days between two UTC midnights, inclusive of the start, exclusive of the end. */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_PER_DAY));
}

/**
 * The €-share of a half-year-allocated budget that falls inside one PI's window.
 * Sums prorata when the PI straddles two halves: each side gets
 * `budgetByPeriod[H] × (intersected days / total days of H)`.
 * Returns null when no half-year keys overlap the PI (no signal to compute on).
 */
export function prorateArtBudgetToPi(
  pi: { startDate: Date; endDate: Date },
  budgetByPeriod: Record<string, number>,
): number | null {
  let total = 0;
  let touched = false;

  // Walk every half-year start from the PI's start half through its end half.
  const firstHalf = halfYearStart(pi.startDate);
  const endHalfStart = halfYearStart(pi.endDate);

  let cursor = firstHalf;
  // Safety bound — PIs longer than 8 half-years (4 years) are pathological; stop.
  for (let i = 0; i < 16; i++) {
    const halfEnd = addHalfYears(cursor, 1); // exclusive end of this half
    const key = halfYearKey(cursor);
    const pot = budgetByPeriod[key];
    if (typeof pot === "number" && pot > 0) {
      const overlapStart = pi.startDate > cursor ? pi.startDate : cursor;
      const overlapEnd = pi.endDate < halfEnd ? pi.endDate : halfEnd;
      const overlapDays = daysBetween(overlapStart, overlapEnd);
      const halfDays = daysBetween(cursor, halfEnd);
      if (overlapDays > 0 && halfDays > 0) {
        total += pot * (overlapDays / halfDays);
        touched = true;
      }
    }
    if (cursor >= endHalfStart) break;
    cursor = halfEnd;
  }

  return touched ? total : null;
}

/**
 * The capacity bundle for one PI: Job-Size cap (override only) and € cap
 * (override > prorated > null). When no override and no ART budget cell
 * intersects, capacityAmount stays null and the €-axis is hidden.
 */
export function computeCapacity(
  pi: PiWindow,
  artBudgetByPeriod: Record<string, number> | null,
): PiCapacity {
  let capacityAmount: number | null = null;
  let source: PiCapacity["capacityAmountSource"] = null;

  if (pi.capacityAmount !== null) {
    capacityAmount = pi.capacityAmount;
    source = "override";
  } else if (artBudgetByPeriod) {
    const prorated = prorateArtBudgetToPi(pi, artBudgetByPeriod);
    if (prorated !== null) {
      capacityAmount = prorated;
      source = "prorated";
    }
  }

  return {
    piId: pi.id,
    capacityJobSize: pi.capacityJobSize,
    capacityAmount,
    capacityAmountSource: source,
  };
}

/**
 * Demand on one PI from a list of Features: total Job-Size, € equivalent
 * (Job-Size × tenant conversion, when configured), and Feature count.
 */
export function computeDemand(
  features: readonly FeatureForDemand[],
  piId: string,
  costPerJobSizePoint: number | null,
): PiDemand {
  let jobSizeSum = 0;
  let featureCount = 0;
  for (const f of features) {
    if (f.piId !== piId) continue;
    featureCount++;
    jobSizeSum += f.wsjfJobSize ?? 0;
  }
  const amountSum = costPerJobSizePoint !== null ? jobSizeSum * costPerJobSizePoint : null;
  return { piId, jobSizeSum, amountSum, featureCount };
}

/**
 * Utilization band for an Ampel-Tönung on the column header. `ok` ≤ 80%,
 * `warn` > 80% to ≤ 100%, `over` > 100%. When capacity is null/0, returns "ok"
 * (nothing to compare against — show neutrally).
 */
export function utilizationBand(demand: number, capacity: number | null): UtilizationBand {
  if (!capacity || capacity <= 0) return "ok";
  const ratio = demand / capacity;
  if (ratio > 1) return "over";
  if (ratio > 0.8) return "warn";
  return "ok";
}

/** The worst of two bands — used to tint the column when either axis blows over. */
export function combineBands(a: UtilizationBand, b: UtilizationBand): UtilizationBand {
  const rank = { ok: 0, warn: 1, over: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}
