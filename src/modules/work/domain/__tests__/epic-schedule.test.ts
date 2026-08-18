import { describe, it, expect } from "vitest";
import {
  resolveCostStart,
  resolveGoLive,
  timelinePlannedWindow,
  resolveEpicWindow,
  plannedEpicWindow,
  rangeOverlapsPlannedWindow,
} from "@/modules/work/domain/epic-schedule";
import { emptyTimeline, type TimelineFields } from "@/modules/work/domain/timeline";

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

describe("timelinePlannedWindow — Plan-Fenster aus L4.1 → L4.2", () => {
  it("maps implementation_started → plannedStartAt, implementation → plannedEndAt", () => {
    const w = timelinePlannedWindow({
      estimates: { implementation_started: "2026-07-01", implementation: "2027-06-30" },
      actuals: {},
    });
    expect(w.plannedStartAt?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(w.plannedEndAt?.toISOString()).toBe("2027-06-30T00:00:00.000Z");
  });

  it("leaves an endpoint null when its estimate is unset (other estimates ignored)", () => {
    expect(
      timelinePlannedWindow({ estimates: { implementation_started: "2026-07-01" }, actuals: {} }),
    ).toEqual({ plannedStartAt: utc("2026-07-01"), plannedEndAt: null });
    expect(
      timelinePlannedWindow({
        estimates: { backlog: "2026-01-01", implementation: "2027-06-30" },
        actuals: {},
      }),
    ).toEqual({ plannedStartAt: null, plannedEndAt: utc("2027-06-30") });
  });

  it("returns BOTH null for an inverted pair (start > end)", () => {
    expect(
      timelinePlannedWindow({
        estimates: { implementation_started: "2027-06-30", implementation: "2026-07-01" },
        actuals: {},
      }),
    ).toEqual({ plannedStartAt: null, plannedEndAt: null });
  });

  it("returns both null for an empty timeline", () => {
    expect(timelinePlannedWindow(emptyTimeline())).toEqual({
      plannedStartAt: null,
      plannedEndAt: null,
    });
  });
});

describe("resolveEpicWindow — Soll bevorzugt, Ist als Fallback", () => {
  const derived = { start: utc("2026-02-01"), end: utc("2026-08-01") };

  it("returns null when neither Soll nor Ist is set", () => {
    expect(resolveEpicWindow({ plannedStartAt: null, plannedEndAt: null }, null)).toBeNull();
  });

  it("uses the derived Ist window when only that exists", () => {
    const w = resolveEpicWindow({ plannedStartAt: null, plannedEndAt: null }, derived);
    expect(w?.source).toBe("derived");
    expect(w?.start).toEqual(derived.start);
    expect(w?.end).toEqual(derived.end);
  });

  it("uses the planned Soll window when both are set", () => {
    const epic = { plannedStartAt: utc("2026-01-01"), plannedEndAt: utc("2026-12-31") };
    const w = resolveEpicWindow(epic, derived);
    expect(w?.source).toBe("planned");
    expect(w?.start).toEqual(epic.plannedStartAt);
    expect(w?.end).toEqual(epic.plannedEndAt);
  });

  it("falls back to derived if only one endpoint of Soll is set", () => {
    const w = resolveEpicWindow({ plannedStartAt: utc("2026-01-01"), plannedEndAt: null }, derived);
    expect(w?.source).toBe("derived");
  });
});

describe("plannedEpicWindow + rangeOverlapsPlannedWindow", () => {
  const epic = { plannedStartAt: utc("2026-03-01"), plannedEndAt: utc("2026-09-30") };

  it("plannedEpicWindow is null when either endpoint missing", () => {
    expect(plannedEpicWindow({ plannedStartAt: null, plannedEndAt: utc("2026-09-30") })).toBeNull();
    expect(plannedEpicWindow({ plannedStartAt: utc("2026-03-01"), plannedEndAt: null })).toBeNull();
  });

  it("treats every range as inside when no Soll is set (no constraint)", () => {
    expect(
      rangeOverlapsPlannedWindow(
        { plannedStartAt: null, plannedEndAt: null },
        { start: utc("2099-01-01"), end: utc("2099-12-31") },
      ),
    ).toBe(true);
  });

  it("flags ranges fully before / after the Soll-Fenster as non-overlapping", () => {
    expect(
      rangeOverlapsPlannedWindow(epic, { start: utc("2026-01-01"), end: utc("2026-02-15") }),
    ).toBe(false); // entirely before
    expect(
      rangeOverlapsPlannedWindow(epic, { start: utc("2026-10-01"), end: utc("2026-12-31") }),
    ).toBe(false); // entirely after
  });

  it("treats touching boundaries as overlapping", () => {
    expect(
      rangeOverlapsPlannedWindow(epic, { start: utc("2026-01-01"), end: utc("2026-03-01") }),
    ).toBe(true);
    expect(
      rangeOverlapsPlannedWindow(epic, { start: utc("2026-09-30"), end: utc("2026-12-31") }),
    ).toBe(true);
  });
});
