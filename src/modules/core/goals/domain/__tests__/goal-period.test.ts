import { describe, it, expect } from "vitest";
import {
  isGoalPeriodKey,
  parseGoalPeriod,
  formatGoalPeriodKey,
  goalPeriodLabel,
  goalPeriodRange,
  goalPeriodDateLabel,
  currentGoalPeriod,
  anchorQuarterKey,
  compareGoalPeriod,
  goalTimeframe,
  goalTimeframeLabel,
  goalTimeframeStart,
  rangesOverlap,
  timeframeMatchesPeriodKeys,
  type GoalPeriod,
} from "@/modules/core/goals/domain/goal-period";

describe("goalTimeframe / rangesOverlap (individueller Zeitraum)", () => {
  it("Range gewinnt über Bucket, wenn start+end gesetzt", () => {
    const tf = goalTimeframe("2026-Q3", "2026-03-01", "2026-06-30");
    expect(tf?.kind).toBe("range");
    expect(tf && goalTimeframeLabel(tf)).toBe("1. Mär – 30. Jun 2026");
  });

  it("fällt auf Bucket zurück, wenn kein Bereich gesetzt", () => {
    const tf = goalTimeframe("2026-Q3", null, null);
    expect(tf).toEqual({
      kind: "bucket",
      key: "2026-Q3",
      start: new Date(Date.UTC(2026, 6, 1)),
      end: new Date(Date.UTC(2026, 9, 1)),
    });
    expect(goalTimeframeLabel(tf)).toBe("Q3 2026");
  });

  it("null bei komplett leerem Zeitraum", () => {
    expect(goalTimeframe(null, null, null)).toBeNull();
    expect(goalTimeframeLabel(null)).toBe("—");
  });

  it("Jahreswechsel-Label", () => {
    const tf = goalTimeframe(null, "2026-11-01", "2027-02-15");
    expect(tf && goalTimeframeLabel(tf)).toBe("1. Nov 2026 – 15. Feb 2027");
  });

  it("goalTimeframeStart sortiert nach Start; ohne Zeitraum ans Ende", () => {
    const a = goalTimeframe(null, "2026-02-01", "2026-05-01");
    const b = goalTimeframe("2026-Q4", null, null);
    expect(goalTimeframeStart(a)).toBeLessThan(goalTimeframeStart(b));
    expect(goalTimeframeStart(null)).toBe(Number.POSITIVE_INFINITY);
  });

  it("rangesOverlap: halboffen [start,end)", () => {
    const d = (s: string) => new Date(s);
    expect(rangesOverlap(d("2026-01-01"), d("2026-04-01"), d("2026-03-01"), d("2026-06-01"))).toBe(
      true,
    );
    expect(rangesOverlap(d("2026-01-01"), d("2026-04-01"), d("2026-04-01"), d("2026-06-01"))).toBe(
      false,
    );
  });
});

describe("parseGoalPeriod / isGoalPeriodKey", () => {
  it("parses quarter, half and year keys", () => {
    expect(parseGoalPeriod("2026-Q3")).toEqual({ year: 2026, granularity: "quarter", index: 3 });
    expect(parseGoalPeriod("2026-H1")).toEqual({ year: 2026, granularity: "half", index: 1 });
    expect(parseGoalPeriod("2026")).toEqual({ year: 2026, granularity: "year", index: null });
  });

  it("rejects malformed keys", () => {
    for (const bad of ["q4-26", "2026-Q5", "2026-H3", "2026-Q0", "26-Q1", "2026-", "", "Q1-2026"]) {
      expect(parseGoalPeriod(bad)).toBeNull();
      expect(isGoalPeriodKey(bad)).toBe(false);
    }
  });

  it("accepts all valid keys via isGoalPeriodKey", () => {
    for (const ok of ["2026", "2026-H1", "2026-H2", "2026-Q1", "2026-Q4"]) {
      expect(isGoalPeriodKey(ok)).toBe(true);
    }
  });
});

describe("formatGoalPeriodKey round-trips", () => {
  it("format(parse(x)) === x for every granularity", () => {
    for (const key of ["2026-Q2", "2026-H2", "2027"]) {
      expect(formatGoalPeriodKey(parseGoalPeriod(key)!)).toBe(key);
    }
  });
});

describe("goalPeriodLabel", () => {
  it("labels each granularity", () => {
    expect(goalPeriodLabel("2026-Q3")).toBe("Q3 2026");
    expect(goalPeriodLabel("2026-H1")).toBe("H1 2026");
    expect(goalPeriodLabel("2026")).toBe("FY 2026");
  });

  it("falls back to the raw string for malformed legacy values", () => {
    expect(goalPeriodLabel("q4-26")).toBe("q4-26");
  });

  it("accepts a GoalPeriod object", () => {
    const p: GoalPeriod = { year: 2030, granularity: "quarter", index: 1 };
    expect(goalPeriodLabel(p)).toBe("Q1 2030");
  });
});

describe("goalPeriodRange (UTC month boundaries)", () => {
  it("spans a quarter", () => {
    const { start, end } = goalPeriodRange({ year: 2026, granularity: "quarter", index: 3 });
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("spans H1 and H2", () => {
    expect(goalPeriodRange({ year: 2026, granularity: "half", index: 1 }).start.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(goalPeriodRange({ year: 2026, granularity: "half", index: 2 }).start.toISOString()).toBe(
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("spans a full year", () => {
    const { start, end } = goalPeriodRange({ year: 2026, granularity: "year", index: null });
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("goalPeriodDateLabel", () => {
  it("renders German short-month ranges", () => {
    expect(goalPeriodDateLabel("2026-Q3")).toBe("Jul – Sep 2026");
    expect(goalPeriodDateLabel("2026-H1")).toBe("Jan – Jun 2026");
    expect(goalPeriodDateLabel("2026")).toBe("Jan – Dez 2026");
  });

  it("returns empty string for malformed keys", () => {
    expect(goalPeriodDateLabel("nope")).toBe("");
  });
});

describe("currentGoalPeriod", () => {
  it("derives the calendar quarter from a UTC date", () => {
    expect(currentGoalPeriod(new Date("2026-08-15T00:00:00Z"))).toEqual({
      year: 2026,
      granularity: "quarter",
      index: 3,
    });
    expect(currentGoalPeriod(new Date("2026-01-01T00:00:00Z")).index).toBe(1);
    expect(currentGoalPeriod(new Date("2026-12-31T00:00:00Z")).index).toBe(4);
  });
});

describe("anchorQuarterKey", () => {
  it("maps each granularity to its starting quarter", () => {
    expect(anchorQuarterKey("2026-Q2")).toBe("2026-Q2");
    expect(anchorQuarterKey("2026-H1")).toBe("2026-Q1");
    expect(anchorQuarterKey("2026-H2")).toBe("2026-Q3");
    expect(anchorQuarterKey("2026")).toBe("2026-Q1");
  });

  it("returns null for malformed keys", () => {
    expect(anchorQuarterKey("q4-26")).toBeNull();
  });
});

describe("compareGoalPeriod", () => {
  it("orders by start, then by span (shorter first)", () => {
    const q1: GoalPeriod = { year: 2026, granularity: "quarter", index: 1 };
    const q3: GoalPeriod = { year: 2026, granularity: "quarter", index: 3 };
    const h1: GoalPeriod = { year: 2026, granularity: "half", index: 1 };
    const fy: GoalPeriod = { year: 2026, granularity: "year", index: null };
    expect(compareGoalPeriod(q1, q3)).toBeLessThan(0);
    // q1 and h1 share a start; the shorter quarter sorts first
    expect(compareGoalPeriod(q1, h1)).toBeLessThan(0);
    // full year and q1 share a start; quarter (shorter) first
    expect(compareGoalPeriod(q1, fy)).toBeLessThan(0);
    expect(compareGoalPeriod(q3, q1)).toBeGreaterThan(0);
  });
});

describe("timeframeMatchesPeriodKeys (Filter-Diskriminierung)", () => {
  it("Bucket-Ziel matcht nur den exakten Key (H2 trifft Q3 NICHT)", () => {
    const q3 = goalTimeframe("2026-Q3", null, null);
    expect(timeframeMatchesPeriodKeys(q3, ["2026-Q3"])).toBe(true);
    expect(timeframeMatchesPeriodKeys(q3, ["2026-Q2", "2026-Q4"])).toBe(false);
    const h2 = goalTimeframe("2026-H2", null, null);
    expect(timeframeMatchesPeriodKeys(h2, ["2026-Q3"])).toBe(false);
    expect(timeframeMatchesPeriodKeys(h2, ["2026-H2"])).toBe(true);
  });

  it("Range-Ziel matcht per Überlappung mit dem Bucket-Zeitraum", () => {
    // 1. Mär – 30. Jun überlappt Q1 und Q2, nicht Q3.
    const range = goalTimeframe(null, "2026-03-01", "2026-06-30");
    expect(timeframeMatchesPeriodKeys(range, ["2026-Q1"])).toBe(true);
    expect(timeframeMatchesPeriodKeys(range, ["2026-Q2"])).toBe(true);
    expect(timeframeMatchesPeriodKeys(range, ["2026-Q3"])).toBe(false);
    expect(timeframeMatchesPeriodKeys(range, ["2026-Q3", "2026-Q1"])).toBe(true);
  });

  it("null / leere Auswahl trifft nie", () => {
    expect(timeframeMatchesPeriodKeys(null, ["2026-Q1"])).toBe(false);
    expect(timeframeMatchesPeriodKeys(goalTimeframe("2026-Q1", null, null), [])).toBe(false);
  });
});
