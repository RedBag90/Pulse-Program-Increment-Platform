/**
 * Participatory budgeting — pure, UTC, half-year based. Turns each candidate
 * Epic's per-period budget *need* and its *allocated* amounts into half-year
 * buckets, and rolls allocations up per value stream and against the pool.
 * No I/O. Half-year periods (= one 6-month business-case cost slice) keyed as
 * "YYYY-H1" / "YYYY-H2".
 */

export interface HalfYearAxis {
  /** First day of the earliest half-year (UTC). */
  start: Date;
  count: number;
  /** One entry per half-year, oldest first; length === count. */
  periods: { key: string; label: string }[];
}

/** A candidate Epic on the budgeting board (built by the service). */
export interface BudgetEpicView {
  id: string;
  title: string;
  valueStreamId: string | null;
  valueStream: string | null;
  /** Hypothesis-only Epic (no business-case cost slices) → uses hypothesisBudget. */
  isHypothesisOnly: boolean;
  /** Business-case 6-month cost amounts (one per half-year from startKey). */
  costSlices: number[];
  /** Fixed budget for a hypothesis-only Epic (0 if unset). */
  hypothesisBudget: number;
  /** Half-year the Epic starts (scheduled / cost start), e.g. "2026-H1". */
  startKey: string;
  /** Granted amount per half-year key. */
  allocations: Record<string, number>;
  priority: number;
}

// --- half-year helpers (UTC) ----------------------------------------------

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

/**
 * Last day of the last of `periods` half-years starting at `start` — i.e. the
 * day before the half-year after the funded window. `start=2026-07-01, periods=3`
 * → `2027-12-31`. Used to set an Epic's estimated implementation end.
 */
export function fundedEndDate(start: Date, periods: number): Date {
  const afterLast = addHalfYears(halfYearStart(start), Math.max(1, periods));
  return new Date(afterLast.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * The first and last half-year keys that received funding (allocation > 0),
 * or null when nothing is funded. Keys sort lexically ("YYYY-H1" < "YYYY-H2").
 */
export function fundedPeriodRange(
  allocations: Record<string, number>,
): { firstKey: string; lastKey: string } | null {
  const keys = Object.entries(allocations)
    .filter(([, v]) => v > 0)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) return null;
  return { firstKey: keys[0]!, lastKey: keys[keys.length - 1]! };
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

// --- per-Epic need, roll-up, remaining ------------------------------------

/**
 * The budget *need* per half-year key. Business-case Epic: cost slice i lands in
 * the (startKey + i)-th half-year. Hypothesis-only Epic: the fixed budget lands
 * in the start half-year. Keys outside the axis are dropped.
 */
export function requestedByPeriod(
  epic: BudgetEpicView,
  axis: HalfYearAxis,
): Record<string, number> {
  const out: Record<string, number> = {};
  const startDate = parseHalfYearKey(epic.startKey);
  if (!startDate) return out;
  const startIdx = halfYearsBetween(axis.start, startDate);

  const put = (idx: number, amount: number) => {
    if (amount === 0 || idx < 0 || idx >= axis.count) return;
    const key = axis.periods[idx]!.key;
    out[key] = (out[key] ?? 0) + amount;
  };

  if (epic.isHypothesisOnly) {
    put(startIdx, epic.hypothesisBudget);
  } else {
    epic.costSlices.forEach((amount, i) => put(startIdx + i, amount || 0));
  }
  return out;
}

export interface ValueStreamRollup {
  valueStreamId: string | null;
  valueStream: string | null;
  /** Σ allocated per half-year key. */
  byPeriod: Record<string, number>;
  total: number;
}

/** Σ allocated per value stream per half-year (only periods on the axis). */
export function rollupByValueStream(
  epics: BudgetEpicView[],
  axis: HalfYearAxis,
): ValueStreamRollup[] {
  const keys = new Set(axis.periods.map((p) => p.key));
  const byVs = new Map<string, ValueStreamRollup>();
  for (const epic of epics) {
    const vsKey = epic.valueStreamId ?? "__none__";
    let row = byVs.get(vsKey);
    if (!row) {
      row = {
        valueStreamId: epic.valueStreamId,
        valueStream: epic.valueStream,
        byPeriod: {},
        total: 0,
      };
      byVs.set(vsKey, row);
    }
    for (const [key, amount] of Object.entries(epic.allocations)) {
      if (!keys.has(key) || !amount) continue;
      row.byPeriod[key] = (row.byPeriod[key] ?? 0) + amount;
      row.total += amount;
    }
  }
  return [...byVs.values()];
}

/** Total allocated across all Epics per half-year key. */
export function totalAllocatedByPeriod(
  epics: BudgetEpicView[],
  axis: HalfYearAxis,
): Record<string, number> {
  const keys = new Set(axis.periods.map((p) => p.key));
  const out: Record<string, number> = {};
  for (const epic of epics) {
    for (const [key, amount] of Object.entries(epic.allocations)) {
      if (keys.has(key) && amount) out[key] = (out[key] ?? 0) + amount;
    }
  }
  return out;
}

/** Pool − Σ allocated per half-year key (negative = over-allocated). */
export function poolRemaining(
  pool: Record<string, number>,
  epics: BudgetEpicView[],
  axis: HalfYearAxis,
): Record<string, number> {
  const allocated = totalAllocatedByPeriod(epics, axis);
  const out: Record<string, number> = {};
  for (const { key } of axis.periods) {
    out[key] = (pool[key] ?? 0) - (allocated[key] ?? 0);
  }
  return out;
}
