import { describe, it, expect } from "vitest";
import {
  goLiveMonth,
  epicMonthlyFlows,
  aggregatePortfolio,
  groupSeriesByValueStream,
  kpiFulfillmentByMonth,
  recurringFactorByMonth,
  kpiRealizedValueByMonth,
  kpiRecurringByMonth,
  allocatedCostByMonth,
  type EpicEconomicsInput,
  type BenefitKpiInput,
  type EpicSeries,
} from "@/modules/work/domain/portfolio-economics";
import { buildMonthAxis } from "@/modules/core/kernel/domain/calendar";
import type { KpiMeasurement } from "@/modules/core/kpi/domain/kpi";

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

  it("veranschlagt: Σ costSlices taggenau gewichtet im Fenster costStart→goLive", () => {
    const { cost } = epicMonthlyFlows(epic(), axis, axis.monthCount);
    // Fallback ohne Fensterfelder: Fenster = costStart-Monat … goLive-Monat
    // (exklusiv) = Jan–Dez 2024 = 366 Tage (Schaltjahr). Monatswert = Σ ×
    // Monats-Fenstertage ÷ 366 — Monate sind nicht mehr gleich schwer.
    expect(cost[0]).toBeCloseTo((1200 * 31) / 366); // Jan
    expect(cost[1]).toBeCloseTo((1200 * 29) / 366); // Feb (Schaltjahr)
    expect(cost[11]).toBeCloseTo((1200 * 31) / 366); // Dez
    expect(cost[12]).toBe(0); // ab goLive keine Kosten
    expect(cost.reduce((a, b) => a + b, 0)).toBeCloseTo(1200);
  });

  it("implementationStart/-EndExclusive verschieben das Kostenfenster (L4.1→L4.2)", () => {
    const { cost } = epicMonthlyFlows(
      epic({
        implementationStart: utc("2024-07-15"),
        implementationEndExclusive: utc("2024-10-15"),
      }),
      axis,
      axis.monthCount,
    );
    // Fenster 2024-07-15 … 2024-10-14 = 92 Tage: Jul 17 + Aug 31 + Sep 30 + Okt 14.
    expect(cost[5]).toBe(0); // Juni: vor L4.1
    expect(cost[6]).toBeCloseTo((1200 * 17) / 92); // Juli anteilig
    expect(cost[7]).toBeCloseTo((1200 * 31) / 92); // August voll
    expect(cost[9]).toBeCloseTo((1200 * 14) / 92); // Oktober anteilig
    expect(cost[10]).toBe(0); // November: nach Fenster
    expect(cost.reduce((a, b) => a + b, 0)).toBeCloseTo(1200);
  });

  it("starts recurring/12 at go-live and adds the one-time benefit there", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, axis.monthCount);
    // go-live = index 12 (Jan 2025): recurring 100 + one-time 500
    expect(benefit[11]).toBe(0);
    expect(benefit[12]).toBeCloseTo(600);
    expect(benefit[13]).toBeCloseTo(100);
  });

  it("accrues recurring benefit through the axis end (no horizon cap)", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, axis.monthCount);
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
    const series = aggregatePortfolio(
      [epic(), epic({ id: "e2", title: "Epic 2" })],
      axis,
      axis.monthCount,
    );
    expect(series.perEpic).toHaveLength(2);
    const janCost = (1200 * 31) / 366; // Fenster-Gewichtung, s. epicMonthlyFlows
    expect(series.costs[0]).toBeCloseTo(2 * janCost); // two epics
    expect(series.velocity[12]).toBeCloseTo(1200); // two epics @ 600 at go-live
    expect(series.net[0]).toBeCloseTo(-2 * janCost); // pure cost early
  });

  it("accumulates value and cost and finds the break-even month", () => {
    const series = aggregatePortfolio([epic()], axis, axis.monthCount);
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
      axis.monthCount,
    );
    expect(series.breakEvenIndex).toBeNull();
  });

  it("per-Epic accNet is cumulative benefit − cumulative cost (negative early, positive late)", () => {
    const series = aggregatePortfolio([epic()], axis, axis.monthCount);
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
          benefitKind: "recurring",
          recurringInterval: "yearly",
        }, // 1.0
        {
          measurements: [{ date: "2024-01-01", value: 40 }],
          baseline: 40,
          target: 80,
          weight: 0.5,
          valuePerUnit: null,
          benefitKind: "recurring",
          recurringInterval: "yearly",
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
    const { cost } = epicMonthlyFlows({ ...epic(), costByMonth: override }, axis, axis.monthCount);
    expect(cost[5]).toBe(1234);
    expect(cost[0]).toBe(0); // slice forecast (100 in months 0..11) is ignored
  });
});

describe("epicMonthlyFlows — KPI-realized-value velocity", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));

  it("Einmal-Benefit je Monat = Zuwachs der kumulierten one-time-KPI-Realisierung", () => {
    // kumuliert realisiert: +20k@idx3, +20k@idx6, +20k@idx9 → 60k gesamt.
    // recurringBenefit 0 isoliert die Einmal-Realisierung (kein Flat-Fallback).
    const realized = zerosArr(axis.monthCount);
    for (let i = 3; i < 6; i++) realized[i] = 20000;
    for (let i = 6; i < 9; i++) realized[i] = 40000;
    for (let i = 9; i < axis.monthCount; i++) realized[i] = 60000;
    const { benefit } = epicMonthlyFlows(
      { ...epic({ recurringBenefit: 0 }), kpiRealizedValueByMonth: realized },
      axis,
      axis.monthCount,
    );
    expect(benefit[3]).toBeCloseTo(20000); // Zuwachs 0 → 20k
    expect(benefit[4]).toBeCloseTo(0); // kein Zuwachs
    expect(benefit[6]).toBeCloseTo(20000); // 20k → 40k
    expect(benefit[9]).toBeCloseTo(20000); // 40k → 60k
    // one-time-KPI vorhanden ⇒ kein Business-Case-oneTimeBenefit-Spike bei go-live
    expect(benefit[12]).toBeCloseTo(0);
    // Summe = volle one-time-KPI-Wertung 60k
    expect(benefit.reduce((s, v) => s + v, 0)).toBeCloseTo(60000);
  });

  it("keeps the flat forecast gated at go-live when no KPI value is supplied", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, axis.monthCount);
    expect(benefit[11]).toBe(0); // month before go-live — still gated
    expect(benefit[13]).toBeCloseTo(100);
  });
});

const bk = (over: Partial<BenefitKpiInput> = {}): BenefitKpiInput => ({
  measurements: [{ date: "2024-06-10", value: 50 }], // fulfilment 0.5 from Jun
  baseline: 0,
  target: 100,
  weight: 1,
  valuePerUnit: 10, // planned = |100-0| × 10 = 1000
  benefitKind: "recurring",
  recurringInterval: "yearly",
  ...over,
});

describe("kpiRealizedValueByMonth — one-time only", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2024-12-01")); // 12 months

  it("returns null when no valued one-time KPI is linked", () => {
    expect(kpiRealizedValueByMonth([], axis)).toBeNull();
    // a valued KPI that is recurring does not count for the one-time series
    expect(kpiRealizedValueByMonth([bk({ benefitKind: "recurring" })], axis)).toBeNull();
  });

  it("accrues the realized one-time value from the measurement month", () => {
    const r = kpiRealizedValueByMonth([bk({ benefitKind: "one_time" })], axis);
    expect(r).not.toBeNull();
    expect(r![4]).toBeCloseTo(0); // May — before the measurement
    expect(r![5]).toBeCloseTo(500); // Jun — fulfilment 0.5 × planned 1000
    expect(r![11]).toBeCloseTo(500); // plateaus at the last reading
  });

  it("ignores recurring KPIs when both kinds are linked", () => {
    const r = kpiRealizedValueByMonth(
      [bk({ benefitKind: "one_time" }), bk({ benefitKind: "recurring", valuePerUnit: 99 })],
      axis,
    );
    expect(r![11]).toBeCloseTo(500); // only the one-time KPI contributes
  });
});

describe("kpiRecurringByMonth — recurring run-rate", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2024-12-01"));

  it("returns null when no valued recurring KPI is linked", () => {
    expect(kpiRecurringByMonth([], axis)).toBeNull();
    expect(kpiRecurringByMonth([bk({ benefitKind: "one_time" })], axis)).toBeNull();
  });

  it("yearly interval: periodValue/12 × fulfilment per month from the measurement month", () => {
    // recurring/yearly: annual = 1000, monthlyAtFull = 1000/12; fulfilment 0.5 → 500/12
    const r = kpiRecurringByMonth(
      [bk({ benefitKind: "recurring", recurringInterval: "yearly" })],
      axis,
    );
    expect(r).not.toBeNull();
    expect(r![4]).toBeCloseTo(0); // May — before the measurement
    expect(r![5]).toBeCloseTo(1000 / 12 / 2); // Jun onward — run-rate at 0.5 fulfilment
    expect(r![11]).toBeCloseTo(1000 / 12 / 2); // ongoing, not a one-shot
  });

  it("monthly interval: periodValue directly per month (12× the yearly variant)", () => {
    // recurring/monthly: periodValue = 1000 gilt PRO MONAT → monthlyAtFull = 1000; fulfilment 0.5 → 500
    const r = kpiRecurringByMonth(
      [bk({ benefitKind: "recurring", recurringInterval: "monthly" })],
      axis,
    );
    expect(r).not.toBeNull();
    expect(r![4]).toBeCloseTo(0); // before the measurement
    expect(r![5]).toBeCloseTo(500); // 1000 × 0.5, no /12 — exactly 12× the yearly month
    expect(r![11]).toBeCloseTo(500); // ongoing
  });

  it("defaults to yearly when the interval is unknown/absent", () => {
    const r = kpiRecurringByMonth(
      [bk({ benefitKind: "recurring", recurringInterval: "bogus" })],
      axis,
    );
    expect(r![5]).toBeCloseTo(1000 / 12 / 2); // fallback = yearly
  });
});

describe("epicMonthlyFlows — recurring KPI run-rate + one-time fallback", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01"));

  it("adds the recurring run-rate every month and keeps the one-time spike at go-live", () => {
    const recurring = zerosArr(axis.monthCount);
    for (let i = 6; i < axis.monthCount; i++) recurring[i] = 300; // run-rate from idx 6
    const { benefit } = epicMonthlyFlows(
      { ...epic(), kpiRecurringByMonth: recurring },
      axis,
      axis.monthCount,
    );
    expect(benefit[5]).toBeCloseTo(0); // before the run-rate starts
    expect(benefit[6]).toBeCloseTo(300); // run-rate, no flat fallback added
    expect(benefit[13]).toBeCloseTo(300); // ongoing run-rate (not recurringBenefit/12=100)
    expect(benefit[12]).toBeCloseTo(300 + 500); // go-live: run-rate + one-time spike (no one-time KPI)
  });
});

function zerosArr(n: number): number[] {
  return new Array<number>(n).fill(0);
}

describe("groupSeriesByValueStream", () => {
  const mk = (id: string, base: number, hasAllocation = true): EpicSeries => ({
    id,
    title: id,
    cost: [base, base],
    benefit: [base * 2, base * 2],
    benefitUplift: [0, 0],
    net: [base, base],
    accCost: [base, base * 2],
    accBenefit: [base * 2, base * 4],
    accNet: [base, base * 2],
    hasAllocation,
  });

  it("summiert element-weise je Value Stream; Reihenfolge = Name aufsteigend", () => {
    const per = [mk("e1", 10), mk("e2", 5), mk("e3", 7)];
    const vs = new Map<string, string | null>([
      ["e1", "Payments"],
      ["e2", "Payments"],
      ["e3", "Banking"],
    ]);
    const groups = groupSeriesByValueStream(per, vs);
    expect(groups.map((g) => g.title)).toEqual(["Banking", "Payments"]);
    const banking = groups[0]!;
    const payments = groups[1]!;
    expect(banking.id).toBe("vs:Banking");
    expect(banking.cost).toEqual([7, 7]);
    // Payments = e1 + e2 element-weise (beide freigegeben ⇒ eine solide Serie)
    expect(payments.cost).toEqual([15, 15]); // 10+5
    expect(payments.accBenefit).toEqual([30, 60]); // (20+10), (40+20)
    expect(payments.accNet).toEqual([15, 30]); // (10+5), (20+10)
  });

  it("splittet je Value Stream in freigegeben (solid) + veranschlagt (:est)", () => {
    // Ein Value Stream mit einem finanzierten und einem unfinanzierten Epic:
    // die Kosten des finanzierten Epics bleiben SOLID (der Bug der alten
    // .every()-Rollup: ein unfinanziertes Geschwister schraffierte den ganzen Stream).
    const per = [mk("e1", 10, true), mk("e2", 5, false)];
    const vs = new Map<string, string | null>([
      ["e1", "Payments"],
      ["e2", "Payments"],
    ]);
    const groups = groupSeriesByValueStream(per, vs);
    expect(groups.map((g) => g.id)).toEqual(["vs:Payments", "vs:Payments:est"]);
    expect(groups.every((g) => g.title === "Payments")).toBe(true);
    expect(groups[0]!.cost).toEqual([10, 10]); // freigegeben = nur e1
    expect(groups[1]!.cost).toEqual([5, 5]); // veranschlagt = nur e2
  });

  it("null-Value-Stream ⇒ 'Ohne Wertstrom'-Bucket, immer zuletzt", () => {
    const per = [mk("e1", 3), mk("e2", 4)];
    const vs = new Map<string, string | null>([
      ["e1", null],
      ["e2", "Alpha"],
    ]);
    const groups = groupSeriesByValueStream(per, vs);
    expect(groups.map((g) => g.title)).toEqual(["Alpha", "Ohne Wertstrom"]);
    expect(groups[1]!.id).toBe("vs:__none__");
    expect(groups[1]!.cost).toEqual([3, 3]);
  });

  it("idPrefix/Label parametrisieren die Gruppierung (Nach-ART-Sicht)", () => {
    const per = [mk("e1", 10, true), mk("e2", 5, false), mk("e3", 3)];
    const art = new Map<string, string | null>([
      ["e1", "ART Alpha"],
      ["e2", "ART Alpha"],
      ["e3", null],
    ]);
    const groups = groupSeriesByValueStream(per, art, "Ohne ART", "art");
    expect(groups.map((g) => g.id)).toEqual(["art:ART Alpha", "art:ART Alpha:est", "art:__none__"]);
    expect(groups[2]!.title).toBe("Ohne ART"); // Unassigned-Bucket zuletzt
    expect(groups[0]!.cost).toEqual([10, 10]); // freigegeben solid
    expect(groups[1]!.cost).toEqual([5, 5]); // veranschlagt :est
  });
});
