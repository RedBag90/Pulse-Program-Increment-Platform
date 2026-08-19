/**
 * Participatory budgeting — pure, UTC, half-year based. Turns each candidate
 * Epic's per-period budget *need* and its *allocated* amounts into half-year
 * buckets, and rolls allocations up per value stream and against the pool.
 * No I/O. Half-year periods (= one 6-month business-case cost slice) keyed as
 * "YYYY-H1" / "YYYY-H2".
 */

import {
  parseHalfYearKey,
  halfYearsBetween,
  type HalfYearAxis,
} from "@/modules/core/kernel/domain/calendar";
import { addPeriod, remainingByPeriod } from "@/modules/budgeting/domain/period-map";

// Geteilte Budget-Perioden-Primitive leben im Core-Kernel (Work + Budgeting
// konsumieren sie); hier re-exportiert, damit Budgeting-interne Caller (Service/
// Board/Revision) weiter aus `@/domain/budgeting` importieren.
export { parsePeriodAmountMap } from "@/modules/core/kernel/domain/budget-period";

// Half-year period maths lives in the calendar module; re-exported so existing
// callers (budgeting service/board, tests) keep importing them from here.
export { parseHalfYearKey, buildHalfYearAxis } from "@/modules/core/kernel/domain/calendar";
export type { HalfYearAxis } from "@/modules/core/kernel/domain/calendar";

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
      if (!keys.has(key)) continue;
      addPeriod(row.byPeriod, key, amount);
      row.total += amount;
    }
  }
  return [...byVs.values()];
}

/**
 * The canonical display label/series key for allocations whose Epic has no
 * value stream. Single owner: the pivot below and the chart's `<Bar>` dataKey
 * both reference this, so the fallback string is written down exactly once.
 */
export const UNASSIGNED_VALUE_STREAM_LABEL = "Ohne Wertstrom";

/** The display label/series key a rollup row contributes to the chart. */
export function valueStreamSeriesKey(row: Pick<ValueStreamRollup, "valueStream">): string {
  return row.valueStream ?? UNASSIGNED_VALUE_STREAM_LABEL;
}

/** One chart row per period: `{ label, [valueStreamKey]: amount, … }`. */
export type ChartRow = Record<string, number | string> & { label: string };

/**
 * Pivot a value-stream rollup into per-period chart rows keyed by VS display
 * name (unassigned → the one canonical {@link UNASSIGNED_VALUE_STREAM_LABEL}).
 * Pure; the board calls this instead of pivoting inline.
 */
export function buildValueStreamSeries(
  rollup: ValueStreamRollup[],
  periods: { key: string; label: string }[],
): ChartRow[] {
  return periods.map((p) => {
    const row: ChartRow = { label: p.label };
    for (const r of rollup) row[valueStreamSeriesKey(r)] = r.byPeriod[p.key] ?? 0;
    return row;
  });
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
      if (keys.has(key)) addPeriod(out, key, amount);
    }
  }
  return out;
}

/**
 * Pool − Σ allocated per half-year key (negative = over-allocated). The fachliche
 * Name stays here; the arithmetic is the shared `remainingByPeriod` primitive —
 * the same shape `artBudgetRemaining` uses one level down.
 */
export function poolRemaining(
  pool: Record<string, number>,
  epics: BudgetEpicView[],
  axis: HalfYearAxis,
): Record<string, number> {
  return remainingByPeriod(
    pool,
    epics.map((e) => e.allocations),
    axis.periods.map((p) => p.key),
  );
}
