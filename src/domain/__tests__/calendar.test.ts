import { describe, it, expect } from "vitest";
import {
  isoDay,
  dayStart,
  monthStart,
  addMonths,
  monthDiff,
  parseIsoMonth,
  buildMonthAxis,
  halfYearStart,
  halfYearKey,
  halfYearLabel,
  parseHalfYearKey,
  addHalfYears,
  halfYearsBetween,
  buildHalfYearAxis,
} from "@/domain/calendar";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("day helpers", () => {
  it("isoDay formats UTC yyyy-mm-dd", () => {
    expect(isoDay(utc("2024-03-17"))).toBe("2024-03-17");
    expect(isoDay(new Date("2024-03-17T23:30:00.000Z"))).toBe("2024-03-17");
  });

  it("dayStart truncates to UTC midnight of the given instant", () => {
    expect(dayStart(new Date("2024-03-17T14:25:00.000Z")).toISOString()).toBe(
      "2024-03-17T00:00:00.000Z",
    );
  });
});

describe("month helpers", () => {
  it("monthStart truncates to the first of the month (UTC)", () => {
    expect(monthStart(utc("2024-03-17")).toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });

  it("addMonths rolls across year boundaries", () => {
    expect(addMonths(utc("2024-11-01"), 3).toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  it("monthDiff counts whole months, signed", () => {
    expect(monthDiff(utc("2024-01-01"), utc("2025-01-01"))).toBe(12);
    expect(monthDiff(utc("2024-06-01"), utc("2024-03-01"))).toBe(-3);
  });

  it("parseIsoMonth returns a month-start or null", () => {
    expect(parseIsoMonth("2024-05-20")?.toISOString()).toBe("2024-05-01T00:00:00.000Z");
    expect(parseIsoMonth("")).toBeNull();
    expect(parseIsoMonth(undefined)).toBeNull();
    expect(parseIsoMonth("not-a-date")).toBeNull();
  });
});

describe("buildMonthAxis", () => {
  it("spans the from-month to the to-month inclusively", () => {
    const axis = buildMonthAxis(utc("2024-01-10"), utc("2024-03-25"));
    expect(axis.monthCount).toBe(3);
    expect(axis.months.map((m) => m.key)).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(axis.months[0]!.label).toBe("Jan 2024");
  });

  it("never collapses below one month", () => {
    expect(buildMonthAxis(utc("2024-05-01"), utc("2024-05-28")).monthCount).toBe(1);
  });
});

describe("half-year helpers", () => {
  it("maps a date to its half-year start and key", () => {
    expect(halfYearStart(utc("2026-03-20")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(halfYearStart(utc("2026-08-01")).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(halfYearKey(utc("2026-03-20"))).toBe("2026-H1");
    expect(halfYearKey(utc("2026-08-01"))).toBe("2026-H2");
  });

  it("labels a key as half + year", () => {
    expect(halfYearLabel("2026-H1")).toBe("H1 2026");
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
});

describe("buildHalfYearAxis", () => {
  it("builds an inclusive half-year axis", () => {
    const axis = buildHalfYearAxis(utc("2026-02-01"), utc("2027-03-01"));
    expect(axis.count).toBe(3);
    expect(axis.periods.map((p) => p.key)).toEqual(["2026-H1", "2026-H2", "2027-H1"]);
    expect(axis.periods[0]!.label).toBe("H1 2026");
  });
});
