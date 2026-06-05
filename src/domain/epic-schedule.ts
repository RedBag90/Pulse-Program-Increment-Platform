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
 * The funded window of an Epic — derived from the first/last allocation
 * period. Single source of truth for both representations a caller might want:
 * Date pair (for Prisma columns like `Initiative.plannedStartAt/EndAt`) and
 * ISO strings (for the JSON `timeline.estimates` payload). Both views describe
 * the same window — start = first day of first funded half-year, end = last
 * day of last funded half-year. `start <= end` by construction.
 */
export interface FundedWindow {
  /** Funded period boundaries by half-year key, e.g. "2026-H1". */
  firstKey: string;
  lastKey: string;
  /** Start of the first funded half-year (UTC). */
  start: Date;
  /** Last day of the last funded half-year (UTC). */
  end: Date;
  /** ISO-string projection for `timeline.estimates`. */
  estimates: ScheduleEstimates;
}

/**
 * Returns the funded window of an Epic, or `null` when nothing is funded. The
 * one place that pins "what does this allocations map describe?" — every
 * downstream representation (Date pair, ISO estimates) is derived from this.
 */
export function fundedWindow(allocations: Record<string, number>): FundedWindow | null {
  const range = fundedPeriodRange(allocations);
  if (!range) return null;
  const first = parseHalfYearKey(range.firstKey);
  const last = parseHalfYearKey(range.lastKey);
  if (!first || !last) return null;
  const start = halfYearStart(first);
  const end = fundedEndDate(last, 1);
  return {
    firstKey: range.firstKey,
    lastKey: range.lastKey,
    start,
    end,
    estimates: { backlog: isoDay(start), implementation: isoDay(end) },
  };
}

/**
 * @deprecated Use `fundedWindow(allocations)?.estimates` directly. Thin alias
 * preserved so existing callers (the budgeting save path) keep compiling while
 * the call sites migrate.
 */
export function scheduleFromFundedWindow(
  allocations: Record<string, number>,
): ScheduleEstimates | null {
  return fundedWindow(allocations)?.estimates ?? null;
}

/**
 * @deprecated Use `fundedWindow(allocations)` and project `{ start, end }`.
 * Thin alias preserved for the same reason as `scheduleFromFundedWindow`.
 */
export function fundedDateRange(
  allocations: Record<string, number>,
): { start: Date; end: Date } | null {
  const fw = fundedWindow(allocations);
  return fw ? { start: fw.start, end: fw.end } : null;
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

// ---------------------------------------------------------------------------
// Soll / Ist — the planned delivery window vs. the one derived from Features.
// ---------------------------------------------------------------------------

/** A delivery window — either the owner's "Soll" or the Features-derived "Ist". */
export interface EpicWindow {
  start: Date;
  end: Date;
  /** "planned" when both columns are set on the Epic; "derived" when computed from Features' PIs. */
  source: "planned" | "derived";
}

/**
 * The Epic's planned delivery window, if both endpoints are set. The owner's
 * "Soll" — what they intended; independent of what's actually scheduled.
 */
export function plannedEpicWindow(epic: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
}): EpicWindow | null {
  if (!epic.plannedStartAt || !epic.plannedEndAt) return null;
  return { start: epic.plannedStartAt, end: epic.plannedEndAt, source: "planned" };
}

/**
 * The single window to render for an Epic: prefers the owner's planned window
 * ("Soll") and falls back to the derived span of its Features' PIs ("Ist").
 * Returns null when neither exists — the Epic has no scheduled work and no plan.
 */
export function resolveEpicWindow(
  epic: { plannedStartAt: Date | null; plannedEndAt: Date | null },
  derived: { start: Date; end: Date } | null,
): EpicWindow | null {
  const planned = plannedEpicWindow(epic);
  if (planned) return planned;
  if (derived) return { start: derived.start, end: derived.end, source: "derived" };
  return null;
}

/**
 * Whether a single date lies *inside* an Epic's planned window. Used to detect
 * a Feature → PI assignment that falls outside the owner's Soll-Fenster. When
 * the window isn't set, every date is considered "inside" (no constraint).
 */
export function dateWithinPlannedWindow(
  epic: { plannedStartAt: Date | null; plannedEndAt: Date | null },
  date: Date,
): boolean {
  const w = plannedEpicWindow(epic);
  if (!w) return true;
  return date >= w.start && date <= w.end;
}

/**
 * Whether a date range *overlaps* the planned window at all (any intersection).
 * `false` means the range lies entirely before the Soll-Start or entirely after
 * the Soll-Ende — i.e. the Feature's PI sits completely outside the Epic plan.
 */
export function rangeOverlapsPlannedWindow(
  epic: { plannedStartAt: Date | null; plannedEndAt: Date | null },
  range: { start: Date; end: Date },
): boolean {
  const w = plannedEpicWindow(epic);
  if (!w) return true;
  return range.start <= w.end && range.end >= w.start;
}
