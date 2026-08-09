/**
 * Budget-Perioden-Primitive (Core-Kernel) — reine Halbjahres-/Funded-Window-Mathe
 * auf Perioden-Amount-Maps (`{ "YYYY-H1": 12345, … }`). Bewusst Core, weil sowohl
 * **Work** (Epic-Schedule, Portfolio-Dashboard) als auch **Budgeting** sie
 * konsumieren — Work darf nicht auf Budgeting zeigen (ADR-0013), also leben die
 * geteilten Primitive unten im Kernel. No I/O.
 */

import { halfYearStart, addHalfYears } from "@/modules/core/kernel/domain/calendar";

/**
 * Defensive parser for a `{ "YYYY-H1": 12345, … }` JSON map: drops entries whose
 * value isn't a finite number, returns an empty map on null/non-object.
 */
export function parsePeriodAmountMap(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
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
 * The first and last half-year keys that received funding (allocation > 0), or
 * null when nothing is funded. Keys sort lexically ("YYYY-H1" < "YYYY-H2").
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
