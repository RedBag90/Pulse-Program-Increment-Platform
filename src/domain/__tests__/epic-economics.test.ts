import { describe, it, expect } from "vitest";
import {
  deriveEpicEconomics,
  resolveBenefitWeights,
  type EpicEconomicsKpiInput,
  type EpicEconomicsSource,
} from "@/domain/epic-economics";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const kpi = (over: Partial<EpicEconomicsKpiInput> = {}): EpicEconomicsKpiInput => ({
  id: "k1",
  name: "KPI 1",
  baseline: 0,
  target: 100,
  measurements: [],
  benefitWeight: null,
  ...over,
});

describe("resolveBenefitWeights — recurring-benefit share fallback", () => {
  it("uses the literal weights when any KPI is weighted (unweighted → 0)", () => {
    const out = resolveBenefitWeights([
      kpi({ id: "a", benefitWeight: 0.7 }),
      kpi({ id: "b", benefitWeight: null }),
    ]);
    expect(out.map((k) => [k.kpiId, k.weight])).toEqual([
      ["a", 0.7],
      ["b", 0],
    ]);
  });

  it("splits equally when KPIs exist but none is weighted", () => {
    const out = resolveBenefitWeights([kpi({ id: "a" }), kpi({ id: "b" }), kpi({ id: "c" })]);
    expect(out.map((k) => k.weight)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("is empty without KPIs (flat-forecast fallback)", () => {
    expect(resolveBenefitWeights([])).toEqual([]);
  });
});

describe("deriveEpicEconomics", () => {
  const base: EpicEconomicsSource = {
    businessCase: {
      current: {
        costSlices: [{ amount: 600 }, { amount: 400 }],
        oneTimeBenefit: 500,
        recurringBenefit: 1200,
      },
    },
    timeline: { estimates: { backlog: "2026-03-01", implementation: "2027-01-01" }, actuals: {} },
    businessCaseApprovedAt: null,
    hypothesisApprovedAt: null,
    createdAt: utc("2026-01-15"),
    kpis: [],
  };

  it("derives slices, benefits, totals and the schedule anchors", () => {
    const view = deriveEpicEconomics(base);
    expect(view.costSlices).toEqual([600, 400]);
    expect(view.oneTimeBenefit).toBe(500);
    expect(view.recurringBenefit).toBe(1200);
    expect(view.totals.implementationCost).toBe(1000);
    expect(view.hasBusinessCase).toBe(true);
    expect(view.costStart.toISOString()).toBe("2026-03-01T00:00:00.000Z"); // backlog estimate
    expect(view.goLive.toISOString()).toBe("2027-01-01T00:00:00.000Z"); // implementation estimate
  });

  it("resolves costStart from createdAt when the timeline is empty", () => {
    const view = deriveEpicEconomics({ ...base, timeline: {} });
    expect(view.costStart.toISOString()).toBe("2026-01-01T00:00:00.000Z"); // createdAt month
    // no implementation date → goLive = costStart + 2 slices × 6 months = Jan 2027
    expect(view.goLive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("carries the resolved KPI weights through", () => {
    const view = deriveEpicEconomics({
      ...base,
      kpis: [kpi({ id: "a" }), kpi({ id: "b" })],
    });
    expect(view.benefitKpis.map((k) => k.weight)).toEqual([0.5, 0.5]);
  });

  it("reports no business case for empty content", () => {
    const view = deriveEpicEconomics({ ...base, businessCase: null });
    expect(view.hasBusinessCase).toBe(false);
    expect(view.costSlices).toEqual([]);
  });
});
