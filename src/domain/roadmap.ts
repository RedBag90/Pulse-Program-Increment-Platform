/**
 * Roadmap timeframe maths — pure, UTC-based. Backs the Roadmaps module: derives
 * an Epic's span from its Features' PI windows, builds the month axis, and maps
 * a date range to a percentage offset for the Gantt bars.
 */

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MonthAxis {
  /** First day of the earliest month (UTC). */
  start: Date;
  /** First day of the month after the latest month (UTC, exclusive). */
  end: Date;
  months: { key: string; label: string }[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function nextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/**
 * Earliest start / latest end across the ranges, ignoring `null` entries.
 * Returns `null` when no range is present — e.g. an Epic whose Features are all
 * unscheduled.
 */
export function deriveTimeframe(ranges: ReadonlyArray<DateRange | null>): DateRange | null {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const r of ranges) {
    if (!r) continue;
    if (start === null || r.start < start) start = r.start;
    if (end === null || r.end > end) end = r.end;
  }
  return start !== null && end !== null ? { start, end } : null;
}

/**
 * Month axis spanning from the earliest range's month to the latest range's
 * month. Empty input yields an axis with no months (degenerate span).
 */
export function buildMonthAxis(ranges: ReadonlyArray<DateRange>): MonthAxis {
  if (ranges.length === 0) {
    const now = monthStart(new Date());
    return { start: now, end: now, months: [] };
  }

  let min = ranges[0]!.start;
  let max = ranges[0]!.end;
  for (const r of ranges) {
    if (r.start < min) min = r.start;
    if (r.end > max) max = r.end;
  }

  const start = monthStart(min);
  const end = nextMonth(max);
  const months: { key: string; label: string }[] = [];
  for (let cur = start; cur < end; cur = nextMonth(cur)) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    months.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[m]} ${y}`,
    });
  }
  return { start, end, months };
}

/**
 * Maps a range to `left`/`width` percentages of the axis span, clamped to
 * [0, 100] so a range reaching past the axis still renders inside it.
 */
export function barMetrics(
  range: DateRange,
  axis: MonthAxis,
): { leftPct: number; widthPct: number } {
  const total = axis.end.getTime() - axis.start.getTime();
  if (total <= 0) return { leftPct: 0, widthPct: 0 };

  const clamp = (n: number): number => Math.min(100, Math.max(0, n));
  const left = clamp(((range.start.getTime() - axis.start.getTime()) / total) * 100);
  const right = clamp(((range.end.getTime() - axis.start.getTime()) / total) * 100);
  return { leftPct: left, widthPct: Math.max(0, right - left) };
}
