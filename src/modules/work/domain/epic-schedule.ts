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
  addDays,
  dayStart,
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
 * The day-precise implementation window **L4.1 → L4.2** — where delivery work
 * happens and estimated cost accrues. Half-open `[start, endExclusive)`:
 *
 * - start = actual L4.1 stamp (`implementationStartedAt`) → owner estimate
 *   `implementation_started` → `monthStart(costStart)` (Epics without an L4.1).
 * - endExclusive = day after (actual → estimated) `implementation` (L4.2) →
 *   the derived go-live fallback `costStart + #slices × 6 months`.
 *
 * An inverted window collapses to a single day so `daysBetween(start,
 * endExclusive)` is always ≥ 1 and spreading `Σ costSlices` never divides by 0.
 */
export function resolveImplementationWindow(
  timeline: TimelineFields,
  implementationStartedAt: Date | null,
  costStart: Date,
  costSlicesCount: number,
): { start: Date; endExclusive: Date } {
  const start =
    (implementationStartedAt ? dayStart(implementationStartedAt) : null) ??
    (timeline.estimates.implementation_started
      ? parseIsoDay(timeline.estimates.implementation_started)
      : null) ??
    monthStart(costStart);
  const l42Iso = timeline.actuals.implementation ?? timeline.estimates.implementation ?? null;
  const l42 = l42Iso ? parseIsoDay(l42Iso) : null;
  const endExclusive = l42
    ? addDays(l42, 1)
    : addMonths(monthStart(costStart), costSlicesCount * 6);
  if (endExclusive.getTime() <= start.getTime()) return { start, endExclusive: addDays(start, 1) };
  return { start, endExclusive };
}

/**
 * **Ab wann Nutzen zählt: L5 „Nutzen erkannt"**, nicht L4.2.
 *
 * Bis September 2026 begann der Nutzen am Go-Live (L4.2, „Umsetzung
 * fertig"). Fertig gebaut heißt aber nicht, dass der Nutzen schon eintritt —
 * dafür gibt es L5. Der Nutzen beginnt deshalb im Monat von L5:
 *
 * - L5 als Ist (`impactRecognizedAt` — der Workflow-Stempel) →
 *   `confirmed`, zählt auch rückwirkend;
 * - L5 als Schätzung (`timeline.estimates.done`) → nicht bestätigt, zählt nur
 *   als Prognose;
 * - ohne L5-Angabe der Rückfall auf den Go-Live (L4.2) — das bisherige
 *   Verhalten, bestätigt nur mit L4.2-Stempel (`implementationAcceptedAt`).
 */
export function resolveBenefitStart(input: {
  timeline: TimelineFields;
  impactRecognizedAt: Date | null;
  goLive: Date;
  implementationAcceptedAt: Date | null;
}): { at: Date; confirmed: boolean } {
  if (input.impactRecognizedAt) {
    return { at: monthStart(input.impactRecognizedAt), confirmed: true };
  }
  const estimate = parseIsoMonth(input.timeline.estimates.done);
  if (estimate) return { at: estimate, confirmed: false };
  return { at: monthStart(input.goLive), confirmed: input.implementationAcceptedAt != null };
}

/**
 * **Where allocated budget becomes cost:** from L4.1 on, up to L4.2 if known.
 *
 * Allocated money (participatory budgeting, per half-year) used to be spread
 * evenly across all six months of its half-year — an Epic created on 23 Sept
 * showed costs on its L0 and L2 days although implementation started on
 * 27 Sept. Costs belong to implementation, so the allocation lands from L4.1.
 *
 * - start = actual L4.1 → estimated `implementation_started` →
 *   `monthStart(costStart)` — the same chain as `resolveImplementationWindow`.
 * - endExclusive = day after (actual → estimated) L4.2; `null` when unknown.
 *   **No synthetic fallback** here: the implementation window's
 *   `costStart + #slices × 6 months` collapses to one day for an Epic without
 *   slices, which would book a whole half-year's money on a single day. Without
 *   L4.2 the allocation simply runs to the end of its half-year.
 */
export function resolveAllocationWindow(
  timeline: TimelineFields,
  implementationStartedAt: Date | null,
  costStart: Date,
): { start: Date; endExclusive: Date | null } {
  const start =
    (implementationStartedAt ? dayStart(implementationStartedAt) : null) ??
    (timeline.estimates.implementation_started
      ? parseIsoDay(timeline.estimates.implementation_started)
      : null) ??
    monthStart(costStart);
  const l42Iso = timeline.actuals.implementation ?? timeline.estimates.implementation ?? null;
  const endExclusive = l42Iso ? addDays(parseIsoDay(l42Iso), 1) : null;
  return {
    start,
    endExclusive: endExclusive && endExclusive.getTime() > start.getTime() ? endExclusive : null,
  };
}

/**
 * The Epic's planned delivery window, derived from the owner's Implementation
 * phase estimates in the timeline: start = L4.1 (`implementation_started`,
 * „Umsetzung gestartet"), end = L4.2 (`implementation`, „Umsetzung fertig").
 *
 * This is the single source for `Initiative.plannedStartAt/plannedEndAt` — the
 * owner sets it in the "Reifegrad-Timeline" tab. Endpoints are `null`
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
