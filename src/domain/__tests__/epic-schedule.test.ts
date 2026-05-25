import { describe, it, expect } from "vitest";
import {
  resolveCostStart,
  resolveGoLive,
  scheduleFromFundedWindow,
  withScheduleEstimates,
} from "@/domain/epic-schedule";
import { emptyTimeline, type TimelineFields } from "@/domain/timeline";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("resolveCostStart — anchored on the Backlog milestone", () => {
  const base = {
    timeline: emptyTimeline(),
    businessCaseApprovedAt: null,
    hypothesisApprovedAt: null,
    createdAt: utc("2024-01-15"),
  };

  it("ignores the Implementation milestone (that is completion, not start)", () => {
    const timeline: TimelineFields = {
      estimates: { implementation: "2024-06-01", backlog: "2024-03-01" },
      actuals: { implementation: "2024-07-10" },
    };
    // backlog estimate wins; implementation actual/estimate do NOT anchor cost start
    expect(resolveCostStart({ ...base, timeline }).toISOString()).toBe("2024-03-01T00:00:00.000Z");
  });

  it("prefers the actual backlog date, then the estimated backlog", () => {
    expect(
      resolveCostStart({
        ...base,
        timeline: { estimates: { backlog: "2024-05-01" }, actuals: { backlog: "2024-04-09" } },
      }).toISOString(),
    ).toBe("2024-04-01T00:00:00.000Z");
  });

  it("falls back to approval dates, then createdAt", () => {
    expect(
      resolveCostStart({ ...base, businessCaseApprovedAt: utc("2024-02-20") }).toISOString(),
    ).toBe("2024-02-01T00:00:00.000Z");
    expect(resolveCostStart(base).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("resolveGoLive — anchored on the Implementation milestone", () => {
  const costStart = utc("2024-01-01");

  it("prefers the actual implementation date, then the estimate", () => {
    expect(
      resolveGoLive(
        { estimates: { implementation: "2025-06-01" }, actuals: { implementation: "2025-08-10" } },
        costStart,
        2,
      ).toISOString(),
    ).toBe("2025-08-01T00:00:00.000Z");
    expect(
      resolveGoLive(
        { estimates: { implementation: "2025-06-15" }, actuals: {} },
        costStart,
        2,
      ).toISOString(),
    ).toBe("2025-06-01T00:00:00.000Z");
  });

  it("derives cost start + #slices × 6 months when nothing is set", () => {
    expect(resolveGoLive(emptyTimeline(), costStart, 3).toISOString()).toBe(
      "2025-07-01T00:00:00.000Z", // Jan 2024 + 18 months
    );
  });
});

describe("scheduleFromFundedWindow — budgeting decision → schedule estimates", () => {
  it("backlog = start of first funded half-year, implementation = end of last", () => {
    expect(scheduleFromFundedWindow({ "2026-H2": 50000, "2027-H1": 70000 })).toEqual({
      backlog: "2026-07-01",
      implementation: "2027-06-30",
    });
  });

  it("ignores zero allocations when bounding the window", () => {
    expect(scheduleFromFundedWindow({ "2026-H1": 0, "2026-H2": 40, "2027-H2": 0 })).toEqual({
      backlog: "2026-07-01",
      implementation: "2026-12-31",
    });
  });

  it("returns null when nothing is funded (timeline left untouched)", () => {
    expect(scheduleFromFundedWindow({})).toBeNull();
    expect(scheduleFromFundedWindow({ "2026-H1": 0 })).toBeNull();
  });
});

describe("withScheduleEstimates — actuals-preserving merge", () => {
  it("sets backlog/implementation estimates, keeps actuals and other estimates", () => {
    const timeline: TimelineFields = {
      estimates: { detailing: "2025-01-01", backlog: "2025-06-01", implementation: "2025-12-01" },
      actuals: { backlog: "2025-05-15" },
    };
    expect(
      withScheduleEstimates(timeline, { backlog: "2026-07-01", implementation: "2027-06-30" }),
    ).toEqual({
      estimates: { detailing: "2025-01-01", backlog: "2026-07-01", implementation: "2027-06-30" },
      actuals: { backlog: "2025-05-15" }, // owner's manual actual survives
    });
  });
});
