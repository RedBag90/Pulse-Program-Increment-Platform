import { describe, it, expect } from "vitest";
import { deriveTimeframe, buildMonthAxis, barMetrics } from "@/domain/roadmap";
import type { DateRange } from "@/domain/roadmap";

/** UTC date helper — `d(2026, 1, 5)` = 5 Jan 2026 (month is 1-based). */
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function range(s: Date, e: Date): DateRange {
  return { start: s, end: e };
}

describe("deriveTimeframe", () => {
  it("returns null for an empty list", () => {
    expect(deriveTimeframe([])).toBeNull();
  });

  it("returns null when every range is null", () => {
    expect(deriveTimeframe([null, null])).toBeNull();
  });

  it("returns the single range unchanged", () => {
    const r = range(d(2026, 1, 5), d(2026, 3, 13));
    expect(deriveTimeframe([r])).toEqual(r);
  });

  it("takes the earliest start and latest end across ranges", () => {
    const result = deriveTimeframe([
      range(d(2026, 3, 16), d(2026, 5, 22)),
      range(d(2026, 1, 5), d(2026, 3, 13)),
      range(d(2026, 5, 25), d(2026, 7, 31)),
    ]);
    expect(result).toEqual(range(d(2026, 1, 5), d(2026, 7, 31)));
  });

  it("ignores null entries among real ranges", () => {
    const result = deriveTimeframe([null, range(d(2026, 2, 1), d(2026, 4, 1)), null]);
    expect(result).toEqual(range(d(2026, 2, 1), d(2026, 4, 1)));
  });
});

describe("buildMonthAxis", () => {
  it("yields no months for empty input", () => {
    expect(buildMonthAxis([]).months).toEqual([]);
  });

  it("covers each month from earliest start to latest end", () => {
    const axis = buildMonthAxis([range(d(2026, 1, 5), d(2026, 3, 13))]);
    expect(axis.months.map((m) => m.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(axis.start).toEqual(d(2026, 1, 1));
    expect(axis.end).toEqual(d(2026, 4, 1));
  });

  it("spans across a year boundary", () => {
    const axis = buildMonthAxis([range(d(2025, 11, 20), d(2026, 1, 10))]);
    expect(axis.months.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("widens to the union of all ranges", () => {
    const axis = buildMonthAxis([
      range(d(2026, 2, 1), d(2026, 2, 28)),
      range(d(2026, 5, 1), d(2026, 6, 30)),
    ]);
    expect(axis.months.map((m) => m.key)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });
});

describe("barMetrics", () => {
  it("spans the full axis for a range covering it", () => {
    const axis = buildMonthAxis([range(d(2026, 1, 1), d(2026, 3, 31))]);
    const { leftPct, widthPct } = barMetrics(range(axis.start, axis.end), axis);
    expect(leftPct).toBe(0);
    expect(widthPct).toBe(100);
  });

  it("places a later range to the right", () => {
    const axis = buildMonthAxis([range(d(2026, 1, 1), d(2026, 4, 30))]);
    const early = barMetrics(range(d(2026, 1, 1), d(2026, 2, 1)), axis);
    const late = barMetrics(range(d(2026, 3, 1), d(2026, 4, 1)), axis);
    expect(late.leftPct).toBeGreaterThan(early.leftPct);
  });

  it("clamps a range reaching beyond the axis to [0, 100]", () => {
    const axis = buildMonthAxis([range(d(2026, 2, 1), d(2026, 2, 28))]);
    const { leftPct, widthPct } = barMetrics(range(d(2025, 1, 1), d(2027, 1, 1)), axis);
    expect(leftPct).toBe(0);
    expect(widthPct).toBe(100);
  });

  it("returns a zero-width bar for a degenerate axis", () => {
    const axis = buildMonthAxis([]);
    expect(barMetrics(range(d(2026, 1, 1), d(2026, 2, 1)), axis)).toEqual({
      leftPct: 0,
      widthPct: 0,
    });
  });
});
