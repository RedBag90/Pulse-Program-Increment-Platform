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

  it("spreads each 6-month slice evenly across its months", () => {
    const { cost } = epicMonthlyFlows(epic(), axis);
    // months 0..11 (2024) carry 100 each; month 12 onward carry 0
    expect(cost.slice(0, 12)).toEqual(new Array(12).fill(100));
    expect(cost[12]).toBe(0);
    expect(cost.reduce((a, b) => a + b, 0)).toBeCloseTo(1200);
  });

  it("starts recurring/12 at go-live and adds the one-time benefit there", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis);
    // go-live = index 12 (Jan 2025): recurring 100 + one-time 500
    expect(benefit[11]).toBe(0);
    expect(benefit[12]).toBeCloseTo(600);
    expect(benefit[13]).toBeCloseTo(100);
  });

  it("accrues recurring benefit through the axis end (no horizon cap)", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis);
    // The axis runs 36 months. After go-live (idx 12) every month carries
    // recurring 100 — including months past the prior horizon, all the way
    // to the axis end.
    expect(benefit[14]).toBeCloseTo(100);
    expect(benefit[15]).toBeCloseTo(100);
    expect(benefit[axis.monthCount - 1]).toBeCloseTo(100);
  });
});

describe("aggregatePortfolio", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));

  it("sums per-Epic flows into the portfolio series", () => {
    const series = aggregatePortfolio([epic(), epic({ id: "e2", title: "Epic 2" })], axis);
    expect(series.perEpic).toHaveLength(2);
    expect(series.costs[0]).toBeCloseTo(200); // two epics @ 100
    expect(series.velocity[12]).toBeCloseTo(1200); // two epics @ 600 at go-live
    expect(series.net[0]).toBeCloseTo(-200); // pure cost early
  });

  it("accumulates value and cost and finds the break-even month", () => {
    const series = aggregatePortfolio([epic()], axis);
    // total cost = 1200; cumulative value crosses it during 2025
    expect(series.accCost.at(-1)).toBeCloseTo(1200);
    expect(series.breakEvenIndex).not.toBeNull();
    const i = series.breakEvenIndex!;
    expect(series.breakEven[i]!).toBeGreaterThanOrEqual(0);
    expect(series.breakEven[i - 1]!).toBeLessThan(0);
  });

  it("reports no break-even when value never covers cost", () => {
    const series = aggregatePortfolio([epic({ recurringBenefit: 0, oneTimeBenefit: 0 })], axis);
    expect(series.breakEvenIndex).toBeNull();
  });

  it("per-Epic accNet is cumulative benefit − cumulative cost (negative early, positive late)", () => {
    const series = aggregatePortfolio([epic()], axis);
    const e = series.perEpic[0]!;
    // accNet = accBenefit − accCost at every month
    e.accNet.forEach((v, i) => expect(v).toBeCloseTo((e.accBenefit[i] ?? 0) - (e.accCost[i] ?? 0)));
    expect(e.accNet[0]!).toBeLessThan(0); // pure cost before go-live
    expect(e.accNet.at(-1)!).toBeGreaterThan(0); // recovers as the axis runs on
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
          valuePerUnit: null,
        }, // 1.0
        {
          measurements: [{ date: "2024-01-01", value: 40 }],
          baseline: 40,
          target: 80,
          weight: 0.5,
          valuePerUnit: null,
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

  it("uses costByMonth instead of the cost slices when provided", () => {
    const override = zerosArr(axis.monthCount);
    override[5] = 1234;
    const { cost } = epicMonthlyFlows({ ...epic(), costByMonth: override }, axis);
    expect(cost[5]).toBe(1234);
    expect(cost[0]).toBe(0); // slice forecast (100 in months 0..11) is ignored
  });
});

describe("epicMonthlyFlows — KPI-realized-value velocity", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));

  it("benefit je Monat = Zuwachs der kumulierten KPI-Realisierung", () => {
    // kumuliert realisiert: +20k@idx3, +20k@idx6, +20k@idx9 → 60k gesamt
    const realized = zerosArr(axis.monthCount);
    for (let i = 3; i < 6; i++) realized[i] = 20000;
    for (let i = 6; i < 9; i++) realized[i] = 40000;
    for (let i = 9; i < axis.monthCount; i++) realized[i] = 60000;
    const { benefit } = epicMonthlyFlows({ ...epic(), kpiRealizedValueByMonth: realized }, axis);
    expect(benefit[3]).toBeCloseTo(20000); // Zuwachs 0 → 20k
    expect(benefit[4]).toBeCloseTo(0); // kein Zuwachs
    expect(benefit[6]).toBeCloseTo(20000); // 20k → 40k
    expect(benefit[9]).toBeCloseTo(20000); // 40k → 60k
    // one-time (500) landet bei go-live (idx 12); dort ist der Zuwachs 0.
    expect(benefit[12]).toBeCloseTo(500);
    // Summe ohne one-time = volle KPI-Wertung 60k
    const sum = benefit.reduce((s, v, i) => s + (i === 12 ? v - 500 : v), 0);
    expect(sum).toBeCloseTo(60000);
  });

  it("keeps the flat forecast gated at go-live when no KPI value is supplied", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis);
    expect(benefit[11]).toBe(0); // month before go-live — still gated
    expect(benefit[13]).toBeCloseTo(100);
  });
});

function zerosArr(n: number): number[] {
  return new Array<number>(n).fill(0);
}
