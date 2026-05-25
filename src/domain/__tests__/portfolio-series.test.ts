import { describe, it, expect } from "vitest";
import {
  buildPortfolioSeries,
  type EpicEconomicsDTO,
  type PortfolioEconomicsData,
} from "@/domain/portfolio-economics";

const dto = (over: Partial<EpicEconomicsDTO> = {}): EpicEconomicsDTO => ({
  id: "e1",
  title: "Epic 1",
  valueStream: null,
  costSlices: [600, 600], // 12 months @ 100/month from costStart
  oneTimeBenefit: 0,
  recurringBenefit: 0,
  costStartIso: "2026-01-01",
  goLiveIso: "2027-01-01",
  hasBusinessCase: true,
  benefitKpis: [],
  hasAllocation: false,
  allocatedByPeriod: {},
  ...over,
});

const data = (epics: EpicEconomicsDTO[], horizonEndIso = "2027-12-01"): PortfolioEconomicsData => ({
  epics,
  axisFromIso: "2026-01-01",
  horizonEndIso,
  costNeutralTarget: null,
});

describe("buildPortfolioSeries — DTO + slicer window → series", () => {
  it("includes only the selected Epics (Projekt-ID filter)", () => {
    const d = data([dto({ id: "a" }), dto({ id: "b" })]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(["a"]),
      fromIso: "2026-01-01",
      toIso: "2026-06-01",
    });
    expect(series.perEpic.map((e) => e.id)).toEqual(["a"]);
    expect(series.costs[0]).toBeCloseTo(100); // one Epic @ 100/month
  });

  it("yields an empty series when nothing is selected", () => {
    const d = data([dto({ id: "a" })]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(),
      fromIso: "2026-01-01",
      toIso: "2026-06-01",
    });
    expect(series.perEpic).toEqual([]);
    expect(series.costs.every((c) => c === 0)).toBe(true);
  });

  it("spans the Stichtag window as the axis", () => {
    const d = data([dto({ id: "a" })]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(["a"]),
      fromIso: "2026-03-10",
      toIso: "2026-06-25",
    });
    expect(series.axis.monthCount).toBe(4); // Mar–Jun 2026 inclusive
    expect(series.axis.months[0]!.key).toBe("2026-03");
  });

  it("drops the cost months that fall before the window (partial overlap nulls them)", () => {
    // Epic costs run Jan–Dec 2026; window starts in March, so Jan/Feb costs are lost.
    const d = data([dto({ id: "a" })]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(["a"]),
      fromIso: "2026-03-01",
      toIso: "2026-12-01",
    });
    // 10 in-window months @ 100 (Mar–Dec); the two pre-window months are not recovered.
    expect(series.costs.reduce((a, b) => a + b, 0)).toBeCloseTo(1000);
    expect(series.costs[0]).toBeCloseTo(100); // March, not the cumulative pre-window cost
  });

  it("applies a per-month KPI factor to the recurring benefit", () => {
    // Recurring 1200/yr = 100/month; one KPI fully met from the first month →
    // factor 1.0, so the recurring benefit pays out from cost start.
    const d = data([
      dto({
        id: "a",
        recurringBenefit: 1200,
        benefitKpis: [
          {
            kpiId: "k",
            name: "K",
            weight: 1,
            baseline: 0,
            target: 100,
            measurements: [{ date: "2026-01-01", value: 100 }],
          },
        ],
      }),
    ]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(["a"]),
      fromIso: "2026-01-01",
      toIso: "2026-06-01",
    });
    expect(series.velocity[0]).toBeCloseTo(100); // 100/month × factor 1.0, from cost start
  });

  it("uses the budget allocation as the cost override when present", () => {
    // 60000 allocated to H1'26 → 10000/month across Jan–Jun, overriding the slices.
    const d = data([
      dto({ id: "a", hasAllocation: true, allocatedByPeriod: { "2026-H1": 60000 } }),
    ]);
    const series = buildPortfolioSeries(d, {
      selectedEpicIds: new Set(["a"]),
      fromIso: "2026-01-01",
      toIso: "2026-06-01",
    });
    expect(series.costs[0]).toBeCloseTo(10000); // allocation, not the 100/month forecast
  });
});
