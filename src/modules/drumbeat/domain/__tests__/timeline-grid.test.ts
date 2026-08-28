import { describe, it, expect } from "vitest";
import {
  piWindowsOverlap,
  findTimelineConflicts,
  buildTimelineAxis,
  buildTimelineGrid,
  timelineBarMetrics,
} from "@/modules/drumbeat/domain/timeline-grid";

/** UTC date helper — `d(2026, 1, 5)` = 5 Jan 2026 (month is 1-based). */
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function win(id: string, s: Date, e: Date) {
  return { id, name: id, startDate: s, endDate: e };
}

describe("buildTimelineAxis", () => {
  it("shows a fixed 12-month window anchored at the earliest PI's month", () => {
    const axis = buildTimelineAxis(
      [
        { startDate: d(2026, 3, 16), endDate: d(2026, 5, 22) },
        { startDate: d(2026, 2, 10), endDate: d(2026, 4, 1) },
      ],
      d(2026, 8, 1),
    );
    expect(axis.months).toHaveLength(12);
    expect(axis.anchor).toEqual(d(2026, 2, 1));
    expect(axis.months[0]!.label).toBe("Feb 2026");
    // 12 months from Feb 2026 → last shown month is Jan 2027.
    expect(axis.months.at(-1)!.label).toBe("Jan 2027");
    expect(axis.months[0]!.leftPx).toBe(0);
    expect(axis.totalWidthPx).toBe(axis.totalDays * axis.pxPerDay);
  });

  it("uses German month labels (identical to the previous calendar)", () => {
    const axis = buildTimelineAxis(
      [{ startDate: d(2026, 3, 1), endDate: d(2026, 3, 20) }],
      d(2026, 1, 1),
    );
    expect(axis.months[0]!.label).toBe("Mär 2026");
  });

  it("anchors at the injected `now` month when there are no PIs", () => {
    const axis = buildTimelineAxis([], d(2026, 7, 15));
    expect(axis.anchor).toEqual(d(2026, 7, 1));
    expect(axis.months).toHaveLength(12);
  });
});

describe("piWindowsOverlap", () => {
  it("touching windows overlap (endDate ist inklusiv)", () => {
    const a = { startDate: d(2026, 1, 1), endDate: d(2026, 3, 1) };
    const b = { startDate: d(2026, 3, 1), endDate: d(2026, 5, 1) };
    expect(piWindowsOverlap(a, b)).toBe(true);
    expect(piWindowsOverlap(b, a)).toBe(true);
  });

  it("adjazente Fenster mit 1-Tag-Lücke überlappen nicht (Standard-PI-Modell)", () => {
    const a = { startDate: d(2026, 1, 1), endDate: d(2026, 2, 28) };
    const b = { startDate: d(2026, 3, 1), endDate: d(2026, 5, 1) };
    expect(piWindowsOverlap(a, b)).toBe(false);
    expect(piWindowsOverlap(b, a)).toBe(false);
  });

  it("genuinely overlapping windows collide", () => {
    const a = { startDate: d(2026, 1, 1), endDate: d(2026, 4, 1) };
    const b = { startDate: d(2026, 3, 1), endDate: d(2026, 6, 1) };
    expect(piWindowsOverlap(a, b)).toBe(true);
    expect(piWindowsOverlap(b, a)).toBe(true);
  });

  it("disjoint windows do not collide", () => {
    const a = { startDate: d(2026, 1, 1), endDate: d(2026, 2, 1) };
    const b = { startDate: d(2026, 5, 1), endDate: d(2026, 6, 1) };
    expect(piWindowsOverlap(a, b)).toBe(false);
  });
});

describe("findTimelineConflicts", () => {
  it("flags both PIs of a conflicting pair", () => {
    const ids = findTimelineConflicts([
      win("a", d(2026, 1, 1), d(2026, 4, 1)),
      win("b", d(2026, 3, 1), d(2026, 6, 1)),
      win("c", d(2026, 7, 1), d(2026, 8, 1)),
    ]);
    expect(ids).toEqual(new Set(["a", "b"]));
  });

  it("returns an empty set for a mutually disjoint set (1-Tag-Lücken)", () => {
    // Inklusive Semantik: Fenster brauchen eine echte Lücke (kein geteilter Tag).
    const ids = findTimelineConflicts([
      win("a", d(2026, 1, 1), d(2026, 1, 31)),
      win("b", d(2026, 2, 1), d(2026, 2, 28)),
      win("c", d(2026, 3, 1), d(2026, 3, 31)),
    ]);
    expect(ids.size).toBe(0);
  });
});

describe("timelineBarMetrics", () => {
  it("positions a bar by its offset from the anchor", () => {
    const axis = buildTimelineAxis(
      [{ startDate: d(2026, 1, 1), endDate: d(2026, 6, 1) }],
      d(2026, 1, 1),
    );
    const { leftPx, widthPx } = timelineBarMetrics(
      { startDate: d(2026, 1, 11), endDate: d(2026, 1, 21) },
      axis,
    );
    // 10 days from the anchor, 10-day span, 6px/day.
    expect(leftPx).toBe(60);
    expect(widthPx).toBe(60);
  });

  it("clamps a sub-two-day PI to a minimum grabbable width", () => {
    const axis = buildTimelineAxis(
      [{ startDate: d(2026, 1, 1), endDate: d(2026, 6, 1) }],
      d(2026, 1, 1),
    );
    const { widthPx } = timelineBarMetrics(
      { startDate: d(2026, 1, 1), endDate: d(2026, 1, 1) },
      axis,
    );
    expect(widthPx).toBe(axis.pxPerDay * 2);
  });
});

describe("buildTimelineGrid", () => {
  it("bundles the axis, conflicts, and per-PI bar metrics", () => {
    const grid = buildTimelineGrid(
      [win("a", d(2026, 1, 1), d(2026, 4, 1)), win("b", d(2026, 3, 1), d(2026, 6, 1))],
      d(2026, 1, 1),
    );
    expect(grid.axis.months).toHaveLength(12);
    expect(grid.conflictIds).toEqual(new Set(["a", "b"]));
    expect(grid.bars.get("a")!.leftPx).toBe(0);
  });
});
