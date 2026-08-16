/**
 * Allocation → Epic schedule mirroring (pure). Turns a participatory-budgeting
 * allocation map into the schedule update budgeting writes onto the Epic: the
 * planned window (`plannedStartAt`/`plannedEndAt`) and the timeline estimates.
 *
 * Invariant: EMPTY allocations clear BOTH planned dates, so the Soll-Fenster
 * never lags behind the funded window. When nothing is funded there is no window
 * to project onto the timeline, so the timeline is left untouched (omitted).
 *
 * No I/O, no clock — the dates come from the allocation map, not `Date.now()`.
 * Budgeting imports Work's schedule/timeline primitives (down); never the reverse.
 */

import { parseTimeline, type TimelineFields } from "@/modules/work/domain/timeline";
import { fundedWindow, withScheduleEstimates } from "@/modules/work/domain/epic-schedule";

export interface AllocationScheduleUpdate {
  /** Start of the first funded half-year, or null when nothing is funded. */
  plannedStartAt: Date | null;
  /** Last day of the last funded half-year, or null when nothing is funded. */
  plannedEndAt: Date | null;
  /**
   * Timeline JSON carrying the funded window as backlog/implementation
   * estimates (actuals + other estimates preserved). Omitted entirely when
   * nothing is funded — the clear-on-empty case leaves the timeline as-is.
   */
  timeline?: TimelineFields;
}

/**
 * Derives the Epic schedule update from where the money actually lands. Given
 * the allocation map and the Epic's stored (raw) timeline JSON, returns the
 * planned window plus, when funded, the timeline with mirrored estimates.
 */
export function computeAllocationScheduleUpdate(
  allocations: Record<string, number>,
  timeline: unknown,
): AllocationScheduleUpdate {
  const fw = fundedWindow(allocations);
  if (!fw) {
    // Clear-on-empty: both dates go null; the timeline is not touched.
    return { plannedStartAt: null, plannedEndAt: null };
  }
  return {
    plannedStartAt: fw.start,
    plannedEndAt: fw.end,
    timeline: withScheduleEstimates(parseTimeline(timeline), fw.estimates),
  };
}
