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

// --- view-model builders ---------------------------------------------------

import {
  portfolioRoadmapRows,
  artRoadmapRows,
  valueStreamRoadmapRows,
  roadmapAxis,
  type RoadmapRow,
} from "@/domain/roadmap";

const pi = (s: Date, e: Date) => ({ startDate: s, endDate: e });

describe("portfolioRoadmapRows", () => {
  it("makes one epic row, timed across its features' PI windows", () => {
    const rows = portfolioRoadmapRows([
      {
        id: "e1",
        title: "Epic 1",
        valueStream: { name: "VS" },
        children: [
          { pi: pi(d(2026, 3, 1), d(2026, 4, 30)) },
          { pi: pi(d(2026, 5, 1), d(2026, 6, 30)) },
          { pi: null },
        ],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "e1",
      label: "Epic 1",
      sublabel: "VS",
      href: "/portfolio/epics/e1",
      depth: 0,
      kind: "epic",
    });
    expect(rows[0]!.range).toEqual({ start: d(2026, 3, 1), end: d(2026, 6, 30) });
  });

  it("leaves range null when no feature is scheduled", () => {
    const rows = portfolioRoadmapRows([
      { id: "e", title: "E", valueStream: null, children: [{ pi: null }] },
    ]);
    expect(rows[0]!.range).toBeNull();
    expect(rows[0]!.sublabel).toBeUndefined();
  });
});

describe("artRoadmapRows", () => {
  it("makes one feature row per feature, ranged by its PI", () => {
    const rows = artRoadmapRows([
      { id: "f1", title: "F1", parent: { title: "Epic A" }, pi: pi(d(2026, 1, 1), d(2026, 2, 1)) },
      { id: "f2", title: "F2", parent: null, pi: null },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["feature", "feature"]);
    expect(rows[0]).toMatchObject({ sublabel: "Epic A", href: "/feature/f1" });
    expect(rows[1]!.range).toBeNull();
  });
});

describe("valueStreamRoadmapRows", () => {
  const epics = [
    {
      id: "e1",
      title: "Epic 1",
      children: [
        {
          id: "f1",
          title: "F1",
          artId: "a1",
          art: { name: "ART 1" },
          pi: pi(d(2026, 1, 1), d(2026, 2, 1)),
        },
        { id: "f2", title: "F2", artId: null, art: null, pi: null },
      ],
    },
  ];

  it("hierarchical: epic followed by its indented features", () => {
    const rows = valueStreamRoadmapRows(epics, "epic");
    expect(rows.map((r) => [r.kind, r.depth])).toEqual([
      ["epic", 0],
      ["feature", 1],
      ["feature", 1],
    ]);
    expect(rows[1]).toMatchObject({ sublabel: "ART 1" });
  });

  it("by-ART: an Epics section, then one group section per ART", () => {
    const rows = valueStreamRoadmapRows(epics, "art");
    expect(rows[0]).toMatchObject({ id: "__epics__", kind: "group" });
    expect(rows.some((r) => r.kind === "group" && r.label === "ART 1")).toBe(true);
    expect(rows.some((r) => r.kind === "group" && r.label === "Ohne ART")).toBe(true);
  });
});

describe("roadmapAxis", () => {
  it("spans the scheduled rows and ignores unscheduled ones", () => {
    const rows: RoadmapRow[] = [
      { id: "a", label: "A", range: range(d(2026, 1, 10), d(2026, 2, 5)), depth: 0, kind: "epic" },
      { id: "b", label: "B", range: null, depth: 0, kind: "epic" },
    ];
    const axis = roadmapAxis(rows);
    expect(axis.months[0]!.key).toBe("2026-01");
    expect(axis.months.at(-1)!.key).toBe("2026-02");
  });
});
