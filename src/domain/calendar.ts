/**
 * Calendar / period maths — the single source of UTC date arithmetic, period
 * axes (month + half-year) and ISO/day formatting for the whole app. Pure, no
 * I/O. Domain modules (portfolio economics, budgeting, roadmap, snapshots) and
 * services build on this instead of reimplementing month/half-year helpers.
 *
 * Period key formats: month `YYYY-MM`, half-year `YYYY-H1|H2`.
 */

export const MONTH_LABELS = [
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

// --- day -------------------------------------------------------------------

/** ISO `yyyy-mm-dd` for a Date (UTC). */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC midnight of the given instant — the canonical key for `@db.Date` columns. */
export function dayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// --- months ----------------------------------------------------------------

export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Whole-month distance from `a` to `b` (b − a); negative if b precedes a. */
export function monthDiff(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Parses an ISO `yyyy-mm-dd` string to a UTC month-start, or null. */
export function parseIsoMonth(iso: string | undefined): Date | null {
  if (!iso || iso.trim() === "") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : monthStart(new Date(t));
}

export interface MonthAxis {
  /** First day of the earliest month (UTC). */
  start: Date;
  /** Number of months on the axis (≥ 1). */
  monthCount: number;
  /** One entry per month, oldest first; length === monthCount. */
  months: { key: string; label: string }[];
}

/** Inclusive month axis spanning the month of `from` to the month of `to`. */
export function buildMonthAxis(from: Date, to: Date): MonthAxis {
  const start = monthStart(from);
  const last = monthStart(to);
  const monthCount = Math.max(1, monthDiff(start, last) + 1);
  const months: { key: string; label: string }[] = [];
  for (let i = 0; i < monthCount; i++) {
    const cur = addMonths(start, i);
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    months.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_LABELS[m]} ${y}`,
    });
  }
  return { start, monthCount, months };
}

// --- half-years ------------------------------------------------------------

function halfIndex(d: Date): number {
  return d.getUTCFullYear() * 2 + (d.getUTCMonth() < 6 ? 0 : 1);
}

export function halfYearStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() < 6 ? 0 : 6, 1));
}

export function halfYearKey(d: Date): string {
  return `${d.getUTCFullYear()}-H${d.getUTCMonth() < 6 ? 1 : 2}`;
}

export function halfYearLabel(key: string): string {
  const [year, half] = key.split("-");
  return `${half} ${year}`;
}

/** Parses a "YYYY-H1|H2" key to the half-year's UTC start, or null. */
export function parseHalfYearKey(key: string): Date | null {
  const m = /^(\d{4})-H([12])$/.exec(key);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), m[2] === "1" ? 0 : 6, 1));
}

export function addHalfYears(d: Date, n: number): Date {
  const total = halfIndex(halfYearStart(d)) + n;
  const year = Math.floor(total / 2);
  const half = total % 2;
  return new Date(Date.UTC(year, half === 0 ? 0 : 6, 1));
}

/** Whole half-years from `a` to `b` (b − a); negative if b precedes a. */
export function halfYearsBetween(a: Date, b: Date): number {
  return halfIndex(halfYearStart(b)) - halfIndex(halfYearStart(a));
}

export interface HalfYearAxis {
  /** First day of the earliest half-year (UTC). */
  start: Date;
  count: number;
  /** One entry per half-year, oldest first; length === count. */
  periods: { key: string; label: string }[];
}

/** Inclusive half-year axis spanning the half-year of `from` to that of `to`. */
export function buildHalfYearAxis(from: Date, to: Date): HalfYearAxis {
  const start = halfYearStart(from);
  const count = Math.max(1, halfYearsBetween(start, halfYearStart(to)) + 1);
  const periods: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const cur = addHalfYears(start, i);
    const key = halfYearKey(cur);
    periods.push({ key, label: halfYearLabel(key) });
  }
  return { start, count, periods };
}
