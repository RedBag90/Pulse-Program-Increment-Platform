import { describe, it, expect } from "vitest";
import { buildAutoKpiSeries, buildNodeProgressSeries } from "@/domain/goal-progress-series";
import type { SeriesNode } from "@/domain/goal-progress-series";
import { goalStatusColor } from "@/domain/goal-status";
import { parseMeasurements, latestMeasurement } from "@/domain/kpi-measurement";

const unit = { metricUnit: "Kunden", metricType: "number", currencyCode: null };

describe("goalStatusColor", () => {
  it("maps status to tier hex", () => {
    expect(goalStatusColor("on_track")).toBe("#10b981");
    expect(goalStatusColor("achieved")).toBe("#10b981");
    expect(goalStatusColor("at_risk")).toBe("#f59e0b");
    expect(goalStatusColor("off_track")).toBe("#f43f5e");
    expect(goalStatusColor("dropped")).toBe("#94a3b8");
    expect(goalStatusColor(null)).toBe("#94a3b8");
  });
});

describe("parseMeasurements / latestMeasurement", () => {
  it("parses + sorts chronologically, ignores malformed", () => {
    const raw = [
      { date: "2026-03-01", value: 5 },
      { date: "2026-01-01", value: 2 },
      { date: "bad" },
      { value: 9 },
    ];
    expect(parseMeasurements(raw)).toEqual([
      { at: "2026-01-01", value: 2 },
      { at: "2026-03-01", value: 5 },
    ]);
    expect(latestMeasurement(raw)).toBe(5);
    expect(latestMeasurement(null)).toBeNull();
    expect(latestMeasurement([])).toBeNull();
  });
});

describe("buildAutoKpiSeries", () => {
  it("running sum of matching-unit KPIs over the union of dates", () => {
    const kpis = [
      {
        unit: "Kunden",
        measurements: [
          { at: "2026-01-01", value: 10 },
          { at: "2026-03-01", value: 30 },
        ],
      },
      { unit: "Kunden", measurements: [{ at: "2026-02-01", value: 5 }] },
      { unit: "Leads", measurements: [{ at: "2026-02-15", value: 999 }] }, // ignoriert
    ];
    expect(buildAutoKpiSeries(unit, kpis)).toEqual([
      { at: "2026-01-01", value: 10 }, // nur KPI A
      { at: "2026-02-01", value: 15 }, // A(10) + B(5)
      { at: "2026-03-01", value: 35 }, // A(30) + B(5)
    ]);
  });
  it("empty when no unit matches", () => {
    expect(
      buildAutoKpiSeries(unit, [{ unit: "Leads", measurements: [{ at: "x", value: 1 }] }]),
    ).toEqual([]);
  });
});

function leaf(over: Partial<SeriesNode>): SeriesNode {
  return {
    progressMode: "manual",
    baseline: 0,
    target: 100,
    current: null,
    rollupWeight: 1,
    unitSpec: unit,
    checkins: [],
    kpis: [],
    children: [],
    ...over,
  };
}

describe("buildNodeProgressSeries", () => {
  it("auto_kpi: KPI sum normalized to progress", () => {
    const node = leaf({
      progressMode: "auto_kpi",
      target: 100,
      kpis: [
        {
          unit: "Kunden",
          measurements: [
            { at: "2026-01-01", value: 20 },
            { at: "2026-02-01", value: 60 },
          ],
        },
      ],
    });
    expect(buildNodeProgressSeries(node, "2026-03-01")).toEqual([
      { at: "2026-01-01", progress: 0.2 },
      { at: "2026-02-01", progress: 0.6 },
    ]);
  });

  it("manual: own check-ins + live end", () => {
    const node = leaf({
      progressMode: "manual",
      current: 40,
      checkins: [{ at: "2026-01-10", progress: 0.1 }],
    });
    expect(buildNodeProgressSeries(node, "2026-02-01")).toEqual([
      { at: "2026-01-10", progress: 0.1 },
      { at: "2026-02-01", progress: 0.4 },
    ]);
  });

  it("rollup: weighted average of children over the date union (step)", () => {
    const a = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [
        { at: "2026-01-01", progress: 0 },
        { at: "2026-03-01", progress: 1 },
      ],
      current: null,
    });
    const b = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-02-01", progress: 0.5 }],
      current: null,
    });
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    // dates: 01-01 (a=0, b none → 0), 02-01 (a=0, b=0.5 → 0.25), 03-01 (a=1, b=0.5 → 0.75)
    expect(buildNodeProgressSeries(parent, "2026-04-01")).toEqual([
      { at: "2026-01-01", progress: 0 },
      { at: "2026-02-01", progress: 0.25 },
      { at: "2026-03-01", progress: 0.75 },
    ]);
  });

  it("rollup: honours weights", () => {
    const a = leaf({
      progressMode: "manual",
      rollupWeight: 3,
      checkins: [{ at: "2026-01-01", progress: 0 }],
      current: null,
    });
    const b = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-01-01", progress: 1 }],
      current: null,
    });
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    expect(buildNodeProgressSeries(parent, "2026-02-01")).toEqual([
      { at: "2026-01-01", progress: 0.25 },
    ]);
  });
});
