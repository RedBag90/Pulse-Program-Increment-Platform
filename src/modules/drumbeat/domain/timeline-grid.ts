/**
 * Timeline-grid maths — pure, UTC-based. Backs the horizontal PI calendar in
 * the cadence module: turns a set of PI windows into a fixed month axis with
 * pixel metrics, positions each PI bar, and flags PIs that overlap (the "PIs
 * on a Timeline may not overlap" rule).
 *
 * All date arithmetic reuses the kernel `calendar` primitives (monthStart,
 * addMonths, isoDay, addDays, daysBetween) — this module never redefines them.
 * Unlike `roadmap.ts`, whose Gantt axis spans exactly the scheduled ranges,
 * the timeline calendar always shows a fixed 12-month window from the earliest
 * PI, so it keeps its own axis builder rather than reusing `buildGanttMonthSpan`.
 *
 * The overlap predicate `piWindowsOverlap` is the single source shared with the
 * server-side PI guard (`pi-planning.ts` `validatePiDates`).
 */

import { monthStart, addMonths, daysBetween } from "@/modules/core/kernel/domain/calendar";

/**
 * Canonical PI-window type for the cadence/timeline domain: a Program
 * Increment's identity plus its date range. Other modules narrow this via
 * `Pick` (roadmap uses just `{ startDate, endDate }`) so "PI window" means one
 * thing across the app.
 */
export interface PiWindow {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

/** The date-range half of a PI window — enough to test overlap or place a bar. */
export type PiDateRange = Pick<PiWindow, "startDate" | "endDate">;

const PX_PER_DAY = 6;
const MONTHS_TO_SHOW = 12;

const MONTH_LABELS_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const;

// --- overlap (shared with the server PI guard) -----------------------------

/**
 * Half-open interval overlap: two PI windows collide when each starts before
 * the other ends. Touching windows (a.end === b.start) do NOT overlap. This is
 * the one predicate behind both the client conflict highlight and the server
 * "no overlapping PIs on a Timeline" guard.
 */
export function piWindowsOverlap(a: PiDateRange, b: PiDateRange): boolean {
  return a.startDate < b.endDate && a.endDate > b.startDate;
}

/**
 * IDs of every PI that overlaps at least one other PI in the set (pairwise).
 * Empty when the windows are mutually disjoint.
 */
export function findTimelineConflicts(
  pis: ReadonlyArray<Pick<PiWindow, "id" | "startDate" | "endDate">>,
): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < pis.length; i++) {
    const a = pis[i]!;
    for (let j = i + 1; j < pis.length; j++) {
      const b = pis[j]!;
      if (piWindowsOverlap(a, b)) {
        out.add(a.id);
        out.add(b.id);
      }
    }
  }
  return out;
}

// --- axis + bar metrics ----------------------------------------------------

export interface TimelineMonth {
  key: string;
  /** German month + year, e.g. "Mär 2026". */
  label: string;
  leftPx: number;
  widthPx: number;
}

export interface TimelineAxis {
  /** First day of the earliest month shown (UTC) — origin for all pixel maths. */
  anchor: Date;
  /** Pixels per day (axis-wide constant). */
  pxPerDay: number;
  /** Total days across the whole window (`MONTHS_TO_SHOW` months from anchor). */
  totalDays: number;
  /** Rendered track width in pixels (`totalDays * pxPerDay`). */
  totalWidthPx: number;
  months: TimelineMonth[];
}

/**
 * Fixed 12-month axis anchored at the earliest PI's month. With no PIs it
 * anchors at `now`'s month (injected — this module never reads the clock).
 */
export function buildTimelineAxis(
  pis: ReadonlyArray<PiDateRange>,
  now: Date,
): TimelineAxis {
  const anchor =
    pis.length === 0
      ? monthStart(now)
      : monthStart(pis.reduce((min, p) => (p.startDate < min ? p.startDate : min), pis[0]!.startDate));

  const end = addMonths(anchor, MONTHS_TO_SHOW);
  const totalDays = daysBetween(anchor, end);

  const months: TimelineMonth[] = Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
    const cur = addMonths(anchor, i);
    const next = addMonths(anchor, i + 1);
    const m = cur.getUTCMonth();
    const y = cur.getUTCFullYear();
    return {
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS_DE[m]} ${y}`,
      leftPx: daysBetween(anchor, cur) * PX_PER_DAY,
      widthPx: daysBetween(cur, next) * PX_PER_DAY,
    };
  });

  return { anchor, pxPerDay: PX_PER_DAY, totalDays, totalWidthPx: totalDays * PX_PER_DAY, months };
}

/**
 * Left/width pixels for a bar on the axis. Width is clamped to a minimum of two
 * days so a single-day PI still renders a grabbable bar.
 */
export function timelineBarMetrics(
  range: PiDateRange,
  axis: Pick<TimelineAxis, "anchor" | "pxPerDay">,
): { leftPx: number; widthPx: number } {
  const leftPx = daysBetween(axis.anchor, range.startDate) * axis.pxPerDay;
  const widthPx = Math.max(
    axis.pxPerDay * 2,
    daysBetween(range.startDate, range.endDate) * axis.pxPerDay,
  );
  return { leftPx, widthPx };
}

export interface TimelineGrid {
  axis: TimelineAxis;
  conflictIds: Set<string>;
  /** Bar metrics per PI id, keyed for O(1) lookup at render time. */
  bars: Map<string, { leftPx: number; widthPx: number }>;
}

/**
 * One-shot grid for a static set of PIs: axis, overlap conflicts, and each PI's
 * bar metrics. Interactive callers (drag) instead compose `buildTimelineAxis`,
 * `findTimelineConflicts`, and `timelineBarMetrics` so the anchor stays pinned
 * to the original PIs while conflicts/bars follow the dragged window.
 */
export function buildTimelineGrid(
  pis: ReadonlyArray<PiWindow>,
  now: Date,
): TimelineGrid {
  const axis = buildTimelineAxis(pis, now);
  const bars = new Map<string, { leftPx: number; widthPx: number }>();
  for (const pi of pis) bars.set(pi.id, timelineBarMetrics(pi, axis));
  return { axis, conflictIds: findTimelineConflicts(pis), bars };
}
