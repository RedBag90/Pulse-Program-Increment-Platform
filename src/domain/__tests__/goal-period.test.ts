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
  type GoalPeriod,
} from "@/domain/goal-period";

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
