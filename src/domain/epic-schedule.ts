/**
 * Epic Schedule — the pure read/derivation model for an Epic's delivery
 * timeline, in one place. Two milestones anchor the schedule:
 *
 * - **costStart** = the Backlog milestone — when delivery (and cost) begins.
 * - **goLive** = the Implementation milestone — completion, when benefit lands.
 *
 * It also owns the rule that turns a participatory-budgeting decision into
 * timeline estimates (`scheduleFromFundedWindow`) and the merge that applies
 * those estimates without clobbering owner-entered actuals or other estimate
 * fields (`withScheduleEstimates`). The two timeline writers — the Epic owner's
 * `saveTimeline` and budgeting's `saveBudgetAllocation` — both lean on these
 * rules, so they stay consistent.
 *
 * Conflict policy (owner vs. budgeting): **last writer wins** — the schedule
 * has a single `timeline` JSON and each writer overwrites it. Budgeting only
 * touches the backlog/implementation *estimates* and preserves actuals, so an
 * owner's manual actuals always survive a re-allocation. No I/O.
 */

import type { TimelineFields } from "@/domain/timeline";
import {
  parseIsoMonth,
  monthStart,
  addMonths,
  isoDay,
  halfYearStart,
  parseHalfYearKey,
} from "@/domain/calendar";
import { fundedPeriodRange, fundedEndDate } from "@/domain/budgeting";

/** The dated facts a cost-start resolution falls back through, newest-first. */
export interface EpicScheduleAnchors {
  timeline: TimelineFields;
  businessCaseApprovedAt: Date | null;
  hypothesisApprovedAt: Date | null;
  createdAt: Date;
}

/**
 * Resolves the calendar month an Epic's costs begin — the start of delivery,
 * anchored on the **Backlog** milestone (when the Epic becomes ready to build).
 * Falls back through actual → estimated backlog → business-case approval →
 * hypothesis approval → createdAt. The Implementation milestone is *not* used
 * here — it marks completion (go-live), see `resolveGoLive`.
 */
export function resolveCostStart(anchors: EpicScheduleAnchors): Date {
  const { timeline, businessCaseApprovedAt, hypothesisApprovedAt, createdAt } = anchors;
  return (
    parseIsoMonth(timeline.actuals.backlog) ??
    parseIsoMonth(timeline.estimates.backlog) ??
    (businessCaseApprovedAt ? monthStart(businessCaseApprovedAt) : null) ??
    (hypothesisApprovedAt ? monthStart(hypothesisApprovedAt) : null) ??
    monthStart(createdAt)
  );
}

/**
 * Resolves the go-live / completion month — the **Implementation** milestone.
 * Uses the actual completion date if recorded (it also marks the Epic Done),
 * else the planned implementation date, else the derived end (cost start +
 * #slices × 6 months) so every Epic still gets a go-live.
 */
export function resolveGoLive(
  timeline: TimelineFields,
  costStart: Date,
  costSlicesCount: number,
): Date {
  return (
    parseIsoMonth(timeline.actuals.implementation) ??
    parseIsoMonth(timeline.estimates.implementation) ??
    addMonths(monthStart(costStart), costSlicesCount * 6)
  );
}

/** Estimate anchors derived from a budgeting decision (ISO `yyyy-mm-dd`). */
export interface ScheduleEstimates {
  /** Start of the first funded half-year. */
  backlog: string;
  /** Last day of the last funded half-year. */
  implementation: string;
}

/**
 * Derives the Epic schedule from where the money actually lands: backlog = the
 * start of the first funded half-year, implementation = the last day of the
 * last funded half-year. Returns null when nothing is funded (the timeline is
 * then left untouched). Backlog ≤ implementation by construction.
 */
export function scheduleFromFundedWindow(
  allocations: Record<string, number>,
): ScheduleEstimates | null {
  const range = fundedPeriodRange(allocations);
  if (!range) return null;
  const first = parseHalfYearKey(range.firstKey);
  const last = parseHalfYearKey(range.lastKey);
  if (!first || !last) return null;
  return {
    backlog: isoDay(halfYearStart(first)),
    implementation: isoDay(fundedEndDate(last, 1)),
  };
}

/**
 * Merges schedule estimate anchors into a timeline, preserving the owner's
 * actuals and any other estimate fields (detailing, business_case). The basis
 * of budgeting's "last writer wins, but never clobber actuals" guarantee.
 */
export function withScheduleEstimates(
  timeline: TimelineFields,
  estimates: ScheduleEstimates,
): TimelineFields {
  return {
    estimates: {
      ...timeline.estimates,
      backlog: estimates.backlog,
      implementation: estimates.implementation,
    },
    actuals: timeline.actuals,
  };
}
