import { describe, it, expect } from "vitest";
import {
  halfYearStart,
  halfYearKey,
  parseHalfYearKey,
  addHalfYears,
  halfYearsBetween,
  fundedEndDate,
  fundedPeriodRange,
  buildHalfYearAxis,
  requestedByPeriod,
  rollupByValueStream,
  poolRemaining,
  totalAllocatedByPeriod,
  type BudgetEpicView,
} from "@/domain/budgeting";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("half-year helpers", () => {
  it("maps a date to its half-year start and key", () => {
    expect(halfYearStart(utc("2026-03-20")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(halfYearStart(utc("2026-08-01")).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(halfYearKey(utc("2026-03-20"))).toBe("2026-H1");
    expect(halfYearKey(utc("2026-08-01"))).toBe("2026-H2");
  });

  it("parses keys and rolls across year boundaries", () => {
    expect(parseHalfYearKey("2026-H2")?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(parseHalfYearKey("bad")).toBeNull();
    expect(halfYearKey(addHalfYears(utc("2026-07-01"), 1))).toBe("2027-H1");
    expect(halfYearKey(addHalfYears(utc("2026-01-01"), 3))).toBe("2027-H2");
  });

  it("counts half-years between dates, signed", () => {
    expect(halfYearsBetween(utc("2026-01-01"), utc("2027-01-01"))).toBe(2);
    expect(halfYearsBetween(utc("2026-07-01"), utc("2026-02-01"))).toBe(-1);
  });

  it("fundedEndDate is the last day of the last funded period", () => {
    expect(fundedEndDate(utc("2026-07-01"), 3).toISOString().slice(0, 10)).toBe("2027-12-31");
    expect(fundedEndDate(utc("2026-01-01"), 1).toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(fundedEndDate(utc("2026-07-01"), 1).toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(fundedEndDate(utc("2026-03-15"), 2).toISOString().slice(0, 10)).toBe("2026-12-31"); // H1'26 start, 2 periods
    expect(fundedEndDate(utc("2026-01-01"), 0).toISOString().slice(0, 10)).toBe("2026-06-30"); // min 1
  });

  it("fundedPeriodRange returns the first/last funded half-year", () => {
    expect(fundedPeriodRange({ "2026-H2": 50000, "2027-H1": 70000, "2027-H2": 85000 })).toEqual({
      firstKey: "2026-H2",
      lastKey: "2027-H2",
    });
    // zero entries are ignored; input order does not matter
    expect(fundedPeriodRange({ "2027-H1": 40, "2026-H1": 0, "2026-H2": 10 })).toEqual({
      firstKey: "2026-H2",
      lastKey: "2027-H1",
    });
    expect(fundedPeriodRange({})).toBeNull();
    expect(fundedPeriodRange({ "2026-H1": 0 })).toBeNull();
  });

  it("builds an inclusive half-year axis", () => {
    const axis = buildHalfYearAxis(utc("2026-02-01"), utc("2027-03-01"));
    expect(axis.count).toBe(3);
    expect(axis.periods.map((p) => p.key)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
    expect(axis.periods[0]!.label).toBe("H1 2026");
  });
});

const axis = buildHalfYearAxis(utc("2026-01-01"), utc("2027-12-01")); // H1'26..H2'27 (4)

const bcEpic = (over: Partial<BudgetEpicView> = {}): BudgetEpicView => ({
  id: "e1",
  title: "BC Epic",
  valueStreamId: "vs1",
  valueStream: "Stream 1",
  isHypothesisOnly: false,
  costSlices: [100, 200],
  hypothesisBudget: 0,
  startKey: "2026-H1",
  allocations: {},
  priority: 0,
  ...over,
});

describe("requestedByPeriod", () => {
  it("places each business-case slice in consecutive half-years from the start", () => {
    expect(requestedByPeriod(bcEpic(), axis)).toEqual({ "2026-H1": 100, "2026-H2": 200 });
  });

  it("respects a later start half-year", () => {
    expect(requestedByPeriod(bcEpic({ startKey: "2026-H2" }), axis)).toEqual({
      "2026-H2": 100,
      "2027-H1": 200,
    });
  });

  it("drops slices that fall past the axis end", () => {
    const e = bcEpic({ startKey: "2027-H2", costSlices: [50, 60] }); // 2nd slice → 2028-H1 (off axis)
    expect(requestedByPeriod(e, axis)).toEqual({ "2027-H2": 50 });
  });

  it("places a hypothesis fixed budget in the start half-year", () => {
    const h = bcEpic({
      isHypothesisOnly: true,
      costSlices: [],
      hypothesisBudget: 75,
      startKey: "2026-H2",
    });
    expect(requestedByPeriod(h, axis)).toEqual({ "2026-H2": 75 });
  });
});

describe("rollup + remaining", () => {
  const epics: BudgetEpicView[] = [
    bcEpic({ id: "a", valueStreamId: "vs1", valueStream: "S1", allocations: { "2026-H1": 100 } }),
    bcEpic({
      id: "b",
      valueStreamId: "vs1",
      valueStream: "S1",
      allocations: { "2026-H1": 50, "2026-H2": 40 },
    }),
    bcEpic({ id: "c", valueStreamId: "vs2", valueStream: "S2", allocations: { "2026-H1": 30 } }),
  ];

  it("sums allocations per value stream per period", () => {
    const rows = rollupByValueStream(epics, axis);
    const s1 = rows.find((r) => r.valueStreamId === "vs1")!;
    const s2 = rows.find((r) => r.valueStreamId === "vs2")!;
    expect(s1.byPeriod).toEqual({ "2026-H1": 150, "2026-H2": 40 });
    expect(s1.total).toBe(190);
    expect(s2.byPeriod).toEqual({ "2026-H1": 30 });
  });

  it("totals allocations across all epics per period", () => {
    expect(totalAllocatedByPeriod(epics, axis)).toEqual({ "2026-H1": 180, "2026-H2": 40 });
  });

  it("computes pool remaining per period (negative when over-allocated)", () => {
    const remaining = poolRemaining({ "2026-H1": 200, "2026-H2": 10 }, epics, axis);
    expect(remaining["2026-H1"]).toBe(20); // 200 - 180
    expect(remaining["2026-H2"]).toBe(-30); // 10 - 40
    expect(remaining["2027-H1"]).toBe(0); // no pool, no allocation
  });
});
