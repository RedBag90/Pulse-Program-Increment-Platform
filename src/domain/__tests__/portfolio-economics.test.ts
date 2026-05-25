import { describe, it, expect } from "vitest";
import {
  goLiveMonth,
  epicMonthlyFlows,
  aggregatePortfolio,
  kpiFulfillmentByMonth,
  recurringFactorByMonth,
  allocatedCostByMonth,
  type EpicEconomicsInput,
} from "@/domain/portfolio-economics";
import { buildMonthAxis } from "@/domain/calendar";
import type { KpiMeasurement } from "@/domain/kpi";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const epic = (over: Partial<EpicEconomicsInput> = {}): EpicEconomicsInput => ({
  id: "e1",
  title: "Epic 1",
  costSlices: [600, 600], // 12 months @ 100/month
  oneTimeBenefit: 500,
  recurringBenefit: 1200, // 100/month
  costStart: utc("2024-01-01"),
  goLive: utc("2025-01-01"), // costStart + 12 months → axis index 12
  ...over,
});

describe("goLiveMonth", () => {
  it("is costStart + 6 months per slice", () => {
    expect(goLiveMonth(epic()).toISOString()).toBe("2025-01-01T00:00:00.000Z"); // 2 slices = 12 mo
  });
});

describe("epicMonthlyFlows", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01")); // 36 months
  const horizon = utc("2026-12-01");

  it("spreads each 6-month slice evenly across its months", () => {
    const { cost } = epicMonthlyFlows(epic(), axis, horizon);
    // months 0..11 (2024) carry 100 each; month 12 onward carry 0
    expect(cost.slice(0, 12)).toEqual(new Array(12).fill(100));
    expect(cost[12]).toBe(0);
    expect(cost.reduce((a, b) => a + b, 0)).toBeCloseTo(1200);
  });

  it("starts recurring/12 at go-live and adds the one-time benefit there", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, horizon);
    // go-live = index 12 (Jan 2025): recurring 100 + one-time 500
    expect(benefit[11]).toBe(0);
    expect(benefit[12]).toBeCloseTo(600);
    expect(benefit[13]).toBeCloseTo(100);
  });

  it("caps recurring benefit at the horizon end", () => {
    const shortHorizon = utc("2025-03-01"); // index 14
    const { benefit } = epicMonthlyFlows(epic(), axis, shortHorizon);
    expect(benefit[14]).toBeCloseTo(100);
    expect(benefit[15]).toBe(0);
  });
});

describe("aggregatePortfolio", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));
  const horizon = utc("2026-12-01");

  it("sums per-Epic flows into the portfolio series", () => {
    const series = aggregatePortfolio([epic(), epic({ id: "e2", title: "Epic 2" })], axis, horizon);
    expect(series.perEpic).toHaveLength(2);
    expect(series.costs[0]).toBeCloseTo(200); // two epics @ 100
    expect(series.velocity[12]).toBeCloseTo(1200); // two epics @ 600 at go-live
    expect(series.net[0]).toBeCloseTo(-200); // pure cost early
  });

  it("accumulates value and cost and finds the break-even month", () => {
    const series = aggregatePortfolio([epic()], axis, horizon);
    // total cost = 1200; cumulative value crosses it during 2025
    expect(series.accCost.at(-1)).toBeCloseTo(1200);
    expect(series.breakEvenIndex).not.toBeNull();
    const i = series.breakEvenIndex!;
    expect(series.breakEven[i]!).toBeGreaterThanOrEqual(0);
    expect(series.breakEven[i - 1]!).toBeLessThan(0);
  });

  it("reports no break-even when value never covers cost", () => {
    const series = aggregatePortfolio(
      [epic({ recurringBenefit: 0, oneTimeBenefit: 0 })],
      axis,
      horizon,
    );
    expect(series.breakEvenIndex).toBeNull();
  });

  it("per-Epic accNet is cumulative benefit − cumulative cost (negative early, positive late)", () => {
    const series = aggregatePortfolio([epic()], axis, horizon);
    const e = series.perEpic[0]!;
    // accNet = accBenefit − accCost at every month
    e.accNet.forEach((v, i) => expect(v).toBeCloseTo((e.accBenefit[i] ?? 0) - (e.accCost[i] ?? 0)));
    expect(e.accNet[0]!).toBeLessThan(0); // pure cost before go-live
    expect(e.accNet.at(-1)!).toBeGreaterThan(0); // recovers over the horizon
  });
});

describe("kpiFulfillmentByMonth", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2024-12-01")); // 12 months
  const meas: KpiMeasurement[] = [
    { date: "2024-03-15", value: 50 },
    { date: "2024-06-10", value: 60 },
  ];

  it("is 0 before the first measurement, forward-fills, and plateaus after the last", () => {
    const f = kpiFulfillmentByMonth(meas, 40, 80, axis); // band = 40
    expect(f[0]).toBe(0); // Jan — no measurement yet
    expect(f[1]).toBe(0); // Feb
    expect(f[2]).toBeCloseTo(0.25); // Mar: (50-40)/40
    expect(f[3]).toBeCloseTo(0.25); // Apr: forward-fill 50
    expect(f[5]).toBeCloseTo(0.5); // Jun: (60-40)/40
    expect(f[11]).toBeCloseTo(0.5); // Dec: plateau at last value
  });

  it("clamps below at 0 but allows over-achievement above 1", () => {
    expect(kpiFulfillmentByMonth([{ date: "2024-02-01", value: 10 }], 40, 80, axis)[5]).toBe(0);
    expect(
      kpiFulfillmentByMonth([{ date: "2024-02-01", value: 200 }], 40, 80, axis)[5],
    ).toBeCloseTo(4); // (200-40)/40 — no upper clamp
  });

  it("treats a zero-width band as fully met once a value exists", () => {
    const f = kpiFulfillmentByMonth([{ date: "2024-02-01", value: 5 }], 80, 80, axis);
    expect(f[0]).toBe(0);
    expect(f[1]).toBe(1);
  });
});

describe("recurringFactorByMonth", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2024-12-01"));

  it("returns null with no linked KPIs (flat-forecast fallback)", () => {
    expect(recurringFactorByMonth([], axis)).toBeNull();
  });

  it("sums weighted KPI fulfilment", () => {
    const factor = recurringFactorByMonth(
      [
        {
          measurements: [{ date: "2024-01-01", value: 80 }],
          baseline: 40,
          target: 80,
          weight: 0.5,
        }, // 1.0
        {
          measurements: [{ date: "2024-01-01", value: 40 }],
          baseline: 40,
          target: 80,
          weight: 0.5,
        }, // 0
      ],
      axis,
    );
    expect(factor).not.toBeNull();
    expect(factor![5]).toBeCloseTo(0.5); // 0.5*1 + 0.5*0
  });
});

describe("allocatedCostByMonth", () => {
  const axis = buildMonthAxis(utc("2026-01-01"), utc("2027-12-01")); // 24 months

  it("spreads each half-year allocation evenly across its six months", () => {
    const cost = allocatedCostByMonth({ "2026-H2": 60000, "2027-H1": 30000 }, axis);
    // H2'26 = months 6..11 (Jul–Dec 2026) → 10000 each
    expect(cost.slice(0, 6)).toEqual(new Array(6).fill(0)); // H1'26 unfunded
    expect(cost.slice(6, 12)).toEqual(new Array(6).fill(10000));
    // H1'27 = months 12..17 → 5000 each
    expect(cost.slice(12, 18)).toEqual(new Array(6).fill(5000));
    expect(cost.slice(18, 24)).toEqual(new Array(6).fill(0));
  });

  it("ignores zero amounts and malformed keys", () => {
    expect(allocatedCostByMonth({ "2026-H1": 0, bad: 100 }, axis).every((v) => v === 0)).toBe(true);
  });
});

describe("epicMonthlyFlows cost override (budget allocation)", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01")); // 36 months
  const horizon = utc("2026-12-01");

  it("uses costByMonth instead of the cost slices when provided", () => {
    const override = zerosArr(axis.monthCount);
    override[5] = 1234;
    const { cost } = epicMonthlyFlows({ ...epic(), costByMonth: override }, axis, horizon);
    expect(cost[5]).toBe(1234);
    expect(cost[0]).toBe(0); // slice forecast (100 in months 0..11) is ignored
  });
});

describe("epicMonthlyFlows with a recurring factor", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));
  const horizon = utc("2026-12-01");

  it("scales the recurring benefit by the per-month factor", () => {
    const factor = new Array(axis.monthCount).fill(0.5);
    const { benefit } = epicMonthlyFlows(
      { ...epic(), recurringFactorByMonth: factor },
      axis,
      horizon,
    );
    expect(benefit[12]).toBeCloseTo(50 + 500); // recurring 100*0.5 + one-time at go-live
    expect(benefit[13]).toBeCloseTo(50); // 100 * 0.5
  });

  it("books KPI-driven benefit during delivery (before go-live), bound to the KPI", () => {
    // go-live is index 12; a KPI factor active from month 3 must already pay out.
    const factor = zerosArr(axis.monthCount);
    factor[3] = 0.4;
    factor[6] = 0.4;
    const { benefit } = epicMonthlyFlows(
      { ...epic(), recurringFactorByMonth: factor },
      axis,
      horizon,
    );
    expect(benefit[3]).toBeCloseTo(40); // 100 * 0.4 — well before go-live (12)
    expect(benefit[6]).toBeCloseTo(40);
    expect(benefit[2]).toBe(0); // factor 0 there
  });

  it("never books KPI-driven benefit before cost start", () => {
    // costStart in month 6 of the axis; factor is 1.0 everywhere, but months
    // before cost start must stay 0.
    const lateAxis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));
    const factor = new Array(lateAxis.monthCount).fill(1);
    const { benefit } = epicMonthlyFlows(
      { ...epic({ costStart: utc("2024-07-01") }), recurringFactorByMonth: factor },
      lateAxis,
      horizon,
    );
    expect(benefit[5]).toBe(0); // June 2024 — before cost start (July = idx 6)
    expect(benefit[6]).toBeCloseTo(100); // cost start month, factor 1.0
  });

  it("keeps the flat forecast gated at go-live when no factor is supplied", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, horizon);
    expect(benefit[11]).toBe(0); // month before go-live — still gated
    expect(benefit[13]).toBeCloseTo(100);
  });
});

function zerosArr(n: number): number[] {
  return new Array<number>(n).fill(0);
}
