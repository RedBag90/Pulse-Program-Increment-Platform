/**
 * Epic Schedule — the pure read/derivation model for an Epic's delivery
 * timeline, in one place. Two milestones anchor the schedule:
 *
 * - **costStart** = the Backlog milestone — when delivery (and cost) begins.
 * - **goLive** = the Implementation milestone — completion, when benefit lands.
 *
 * The Epic owner's `saveTimeline` is the single writer of the `timeline` JSON.
 * The planned delivery window (`Initiative.plannedStartAt/plannedEndAt`) is
 * derived from the owner's Implementation phase estimates (L4.1 → L4.2) via
 * `timelinePlannedWindow` — budgeting no longer projects a window onto the
 * schedule. No I/O.
 */

import type { TimelineFields } from "@/modules/work/domain/timeline";
import {
  parseIsoMonth,
  monthStart,
  addMonths,
  parseIsoDay,
} from "@/modules/core/kernel/domain/calendar";

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

/**
 * The Epic's planned delivery window, derived from the owner's Implementation
 * phase estimates in the timeline: start = L4.1 (`implementation_started`,
 * „Umsetzung gestartet"), end = L4.2 (`implementation`, „Umsetzung fertig").
 *
 * This is the single source for `Initiative.plannedStartAt/plannedEndAt` — the
 * owner sets it in the "Reifegrad-Phasen und Timeline" tab. Endpoints are `null`
 * when the respective estimate is unset. An inverted pair (start > end) yields
 * BOTH `null`, so downstream consumers that assume `start <= end` never see a
 * corrupt window.
 */
export function timelinePlannedWindow(timeline: TimelineFields): {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
} {
  const start = timeline.estimates.implementation_started
    ? parseIsoDay(timeline.estimates.implementation_started)
    : null;
  const end = timeline.estimates.implementation
    ? parseIsoDay(timeline.estimates.implementation)
    : null;
  if (start && end && start > end) return { plannedStartAt: null, plannedEndAt: null };
  return { plannedStartAt: start, plannedEndAt: end };
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
