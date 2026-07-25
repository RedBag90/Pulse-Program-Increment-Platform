import { describe, it, expect } from "vitest";
import {
  deriveEpicEconomics,
  resolveBenefitWeights,
  epicBenefitFromKpis,
  type BenefitKpiFacts,
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
  valuePerUnit: null,
  benefitKind: "recurring",
  recurringInterval: "yearly",
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

  it("derives slices + totals; benefit comes from KPIs (0 without valued KPI, BC-Felder ignoriert)", () => {
    const view = deriveEpicEconomics(base); // base.kpis = [] → kein Nutzen
    expect(view.costSlices).toEqual([600, 400]);
    expect(view.oneTimeBenefit).toBe(0);
    expect(view.recurringBenefit).toBe(0);
    expect(view.totals.implementationCost).toBe(1000);
    expect(view.totals.oneTimeBenefit).toBe(0);
    expect(view.totals.recurringBenefit).toBe(0);
    expect(view.hasBusinessCase).toBe(true);
    expect(view.costStart.toISOString()).toBe("2026-03-01T00:00:00.000Z"); // backlog estimate
    expect(view.goLive.toISOString()).toBe("2027-01-01T00:00:00.000Z"); // implementation estimate
  });

  it("derives the benefit from valued KPIs (one-time + recurring annualisiert)", () => {
    const view = deriveEpicEconomics({
      ...base,
      kpis: [
        kpi({ id: "o", baseline: 0, target: 10, valuePerUnit: 100, benefitKind: "one_time" }), // 1000
        kpi({
          id: "r",
          baseline: 0,
          target: 5,
          valuePerUnit: 100,
          benefitKind: "recurring",
          recurringInterval: "monthly",
        }), // 5×100×12 = 6000 p.a.
      ],
    });
    expect(view.oneTimeBenefit).toBe(1000);
    expect(view.recurringBenefit).toBe(6000);
    expect(view.totals.oneTimeBenefit).toBe(1000);
    expect(view.totals.recurringBenefit).toBe(6000);
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

describe("epicBenefitFromKpis", () => {
  const fact = (over: Partial<BenefitKpiFacts> = {}): BenefitKpiFacts => ({
    baseline: 0,
    target: 100,
    valuePerUnit: 10,
    benefitKind: "recurring",
    recurringInterval: "yearly",
    ...over,
  });

  it("is 0 without any valued KPI", () => {
    expect(epicBenefitFromKpis([])).toEqual({ oneTimeBenefit: 0, recurringBenefit: 0 });
    expect(epicBenefitFromKpis([fact({ valuePerUnit: null })])).toEqual({
      oneTimeBenefit: 0,
      recurringBenefit: 0,
    });
  });

  it("sums one-time KPIs into oneTimeBenefit (|target−baseline|×valuePerUnit)", () => {
    const b = epicBenefitFromKpis([
      fact({ benefitKind: "one_time", baseline: 0, target: 10, valuePerUnit: 100 }), // 1000
      fact({ benefitKind: "one_time", baseline: 20, target: 0, valuePerUnit: 50 }), // |−20|×50 = 1000
    ]);
    expect(b).toEqual({ oneTimeBenefit: 2000, recurringBenefit: 0 });
  });

  it("recurring yearly = periodValue, monthly = ×12", () => {
    expect(
      epicBenefitFromKpis([fact({ target: 10, valuePerUnit: 100, recurringInterval: "yearly" })])
        .recurringBenefit,
    ).toBe(1000); // 10×100
    expect(
      epicBenefitFromKpis([fact({ target: 10, valuePerUnit: 100, recurringInterval: "monthly" })])
        .recurringBenefit,
    ).toBe(12000); // 10×100×12
  });

  it("splits mixed kinds into the two buckets", () => {
    const b = epicBenefitFromKpis([
      fact({ benefitKind: "one_time", target: 10, valuePerUnit: 100 }), // 1000 one-time
      fact({ benefitKind: "recurring", target: 5, valuePerUnit: 100 }), // 500 recurring p.a.
    ]);
    expect(b).toEqual({ oneTimeBenefit: 1000, recurringBenefit: 500 });
  });
});
