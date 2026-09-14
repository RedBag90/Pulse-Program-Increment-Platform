import { describe, it, expect } from "vitest";
import {
  goLiveMonth,
  epicMonthlyFlows,
  aggregatePortfolio,
  groupSeriesByValueStream,
  foldTopEpicSeries,
  OTHERS_SERIES_ID,
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

/**
 * Ein **abgenommenes** Epic: `quantityFrozenAt` ist der L4.2-Stempel und liegt
 * auf dem Go-Live. Die Voraussetzung stand früher nicht da, weil Nutzen ohne
 * Rücksicht auf die Abnahme zählte; seit er erst ab L4.2 zählt, ist sie das,
 * was diese Tests immer gemeint haben — „ein geliefertes Epic".
 */
const epic = (over: Partial<EpicEconomicsInput> = {}): EpicEconomicsInput => ({
  id: "e1",
  title: "Epic 1",
  costSlices: [600, 600], // 12 months @ 100/month
  oneTimeBenefit: 500,
  recurringBenefit: 1200, // 100/month
  costStart: utc("2024-01-01"),
  goLive: utc("2025-01-01"), // costStart + 12 months → axis index 12
  quantityFrozenAt: utc("2025-01-01"), // L4.2 abgenommen
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
    // Alle drei Zuwächse liegen **vor** der L4.2-Abnahme (idx 12). Gezählt wird
    // erst ab dort — der einmalige Nutzen geht aber nicht verloren, sondern
    // wird im Abnahmemonat gutgeschrieben. Eine Rate vor der Lieferung gäbe es
    // nicht; ein einmaliger Wert fällt an, wenn das Vorhaben live geht.
    expect(benefit[3]).toBe(0);
    expect(benefit[6]).toBe(0);
    expect(benefit[9]).toBe(0);
    expect(benefit[12]).toBeCloseTo(60000);
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

  it("zählt die Run-Rate ab der Abnahme und behält den Einmal-Spike am Go-Live", () => {
    const recurring = zerosArr(axis.monthCount);
    for (let i = 6; i < axis.monthCount; i++) recurring[i] = 300; // gemessene Run-Rate ab idx 6
    const { benefit } = epicMonthlyFlows(
      { ...epic(), kpiRecurringByMonth: recurring },
      axis,
      axis.monthCount,
    );
    expect(benefit[5]).toBeCloseTo(0); // vor der Messung
    // Der KPI bewegt sich ab idx 6, abgenommen ist erst idx 12. Eine laufende
    // Rate vor der Lieferung gibt es nicht — anders als der einmalige Nutzen
    // wird sie **nicht** nachgetragen: sie ist nie geflossen.
    expect(benefit[6]).toBe(0);
    expect(benefit[11]).toBe(0);
    expect(benefit[12]).toBeCloseTo(300 + 500); // Abnahme: Run-Rate + Einmal-Spike
    expect(benefit[13]).toBeCloseTo(300); // laufend (nicht recurringBenefit/12 = 100)
  });
});

/**
 * **Nutzen zählt erst ab L4.2** — die Regel, die das Portfolio-Dashboard davor
 * bewahrt, ungelieferte Arbeit als realisierten Nutzen auszuweisen.
 */
describe("epicMonthlyFlows — Nutzen zählt erst ab L4.2", () => {
  const axis = buildMonthAxis(utc("2024-01-01"), utc("2026-12-01")); // 36 Monate
  const HEUTE = 20; // Sep 2025

  /** Dasselbe Epic, nur ohne Abnahme. */
  const ohneAbnahme = () => {
    const { quantityFrozenAt: _weg, ...rest } = epic();
    void _weg;
    return rest;
  };

  it("ohne Abnahme: in Vergangenheit und laufendem Monat nichts", () => {
    const { benefit } = epicMonthlyFlows(ohneAbnahme(), axis, HEUTE);
    for (let i = 0; i <= HEUTE; i++) expect(benefit[i]).toBe(0);
  });

  it("ohne Abnahme: ab dem geplanten L4.2 in der Zukunft als Prognose", () => {
    // go-live = idx 12, heute = idx 20 ⇒ gezählt wird ab idx 21. Der geplante
    // Go-Live liegt in der Vergangenheit; sein Einmal-Nutzen wandert in den
    // ersten Monat, der zählt — verfällt also nicht, weil der Plan alt ist.
    const { benefit } = epicMonthlyFlows(ohneAbnahme(), axis, HEUTE);
    expect(benefit[21]).toBeCloseTo(500 + 100); // Einmal-Nutzen + Run-Rate
    expect(benefit[22]).toBeCloseTo(100); // danach nur noch die Run-Rate
    expect(benefit[35]).toBeCloseTo(100);
  });

  it("ohne Abnahme und mit geplantem L4.2 in fernerer Zukunft: erst ab dort", () => {
    const spaet = { ...ohneAbnahme(), goLive: utc("2026-06-01") }; // idx 29
    const { benefit } = epicMonthlyFlows(spaet, axis, HEUTE);
    expect(benefit[28]).toBe(0);
    expect(benefit[29]).toBeCloseTo(100 + 500); // Run-Rate + Einmal-Spike
  });

  it("mit Abnahme: ab dem Ist-Monat, auch wenn er in der Vergangenheit liegt", () => {
    const { benefit } = epicMonthlyFlows(epic(), axis, HEUTE);
    expect(benefit[11]).toBe(0); // Monat vor der Abnahme
    expect(benefit[12]).toBeCloseTo(600); // Abnahme: Run-Rate 100 + Einmal 500
    expect(benefit[13]).toBeCloseTo(100);
  });

  it("die Summe des einmaligen Nutzens bleibt erhalten, er verschiebt sich nur", () => {
    const realized = zerosArr(axis.monthCount);
    for (let i = 2; i < axis.monthCount; i++) realized[i] = 9000; // realisiert ab idx 2
    const mitKpi = { ...epic({ recurringBenefit: 0 }), kpiRealizedValueByMonth: realized };
    const { benefit } = epicMonthlyFlows(mitKpi, axis, HEUTE);
    expect(benefit[2]).toBe(0); // vor der Abnahme nicht gezählt
    expect(benefit[12]).toBeCloseTo(9000); // im Abnahmemonat gutgeschrieben
    expect(benefit.reduce((a, b) => a + b, 0)).toBeCloseTo(9000); // nichts verloren
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

describe("Die Menge friert mit L4.2 — kein Forecast auf ein fertiges Epic", () => {
  const axis = buildMonthAxis(utc("2026-01-01"), utc("2026-12-01"));
  const todayIdx = 5; // Juni
  /** KPI bei 70 % der Spanne, gemessen im März; danach nichts mehr. */
  const kpis: BenefitKpiInput[] = [
    {
      baseline: 0,
      target: 100,
      valuePerUnit: 100,
      benefitKind: "recurring",
      recurringInterval: "yearly",
      weight: 1,
      measurements: [{ date: "2026-03-01", value: 70 }] as KpiMeasurement[],
    },
  ];

  // Ausdrücklich **ohne** L4.2-Stempel — der Name sagt es: die Umsetzung läuft
  // noch. Die geteilte Fixture ist abgenommen, hier muss das weg.
  const { quantityFrozenAt: _nochNichtAbgenommen, ...laufendBasis } = epic({
    costStart: utc("2026-01-01"),
    goLive: utc("2026-02-01"),
    ...(kpiRecurringByMonth(kpis, axis)
      ? { kpiRecurringByMonth: kpiRecurringByMonth(kpis, axis)! }
      : {}),
    kpiRecurringAtFull: 10_000 / 12,
  });
  void _nochNichtAbgenommen;
  const laufend = laufendBasis;

  it("solange die Umsetzung läuft, rechnet der Forecast den Rest zum Ziel hoch", () => {
    const f = epicMonthlyFlows(laufend, axis, todayIdx);
    expect(f.benefitUplift.slice(todayIdx + 1).some((v) => v > 0)).toBe(true);
  });

  it("mit der L4.2-Abnahme entfällt die Hochrechnung vollständig", () => {
    // Genau der Fall aus der Praxis: fertig gebaut, KPI bei 70 %, steigt nicht
    // mehr. Vorher schrieb das Portfolio dem Epic die fehlenden 30 % dauerhaft
    // gut — Break-Even und Benefit Velocity waren systematisch zu gut.
    const fertig = { ...laufend, quantityFrozenAt: utc("2026-05-01") };
    const f = epicMonthlyFlows(fertig, axis, todayIdx);
    expect(f.benefitUplift.every((v) => v === 0)).toBe(true);
  });

  it("der gemessene Nutzen läuft weiter — eingefroren wird die Menge, nicht der Fluss", () => {
    const fertig = { ...laufend, quantityFrozenAt: utc("2026-05-01") };
    const f = epicMonthlyFlows(fertig, axis, todayIdx);
    expect(f.benefit[axis.monthCount - 1]).toBeGreaterThan(0);
  });
});

describe("kpiFulfillmentByMonth — Messungen nach dem Einfrieren zählen nicht", () => {
  const axis = buildMonthAxis(utc("2026-01-01"), utc("2026-12-01"));
  const ms: KpiMeasurement[] = [
    { date: "2026-03-01", value: 70 },
    { date: "2026-09-01", value: 100 }, // nach der Abnahme
  ];

  it("ohne Einfrieren steigt die Erfüllung mit der späteren Messung", () => {
    const f = kpiFulfillmentByMonth(ms, 0, 100, axis);
    expect(f[11]).toBeCloseTo(1);
  });

  it("mit Einfrieren hält sie den Stand zum Stichtag", () => {
    const f = kpiFulfillmentByMonth(ms, 0, 100, axis, utc("2026-05-01"));
    expect(f[11]).toBeCloseTo(0.7);
    expect(f[2]).toBeCloseTo(0.7);
  });
});

describe("foldTopEpicSeries", () => {
  /** Eine Serie, deren Gesamt-Benefit (`accBenefit` zuletzt) gleich `benefit` ist. */
  const mk = (id: string, benefit: number, hasAllocation = true): EpicSeries => ({
    id,
    title: id,
    cost: [1, 2],
    benefit: [benefit, 0],
    benefitUplift: [0, 1],
    net: [benefit - 1, -1],
    accCost: [1, 3],
    accBenefit: [benefit, benefit],
    accNet: [benefit - 1, benefit - 2],
    hasAllocation,
  });

  const KEYS = [
    "cost",
    "benefit",
    "benefitUplift",
    "net",
    "accCost",
    "accBenefit",
    "accNet",
  ] as const;

  /** Monatssummen über alle Serien — das, was die Balkenhöhen ergibt. */
  const totals = (per: readonly EpicSeries[]) =>
    Object.fromEntries(
      KEYS.map((k) => [k, [0, 1].map((m) => per.reduce((sum, e) => sum + (e[k][m] ?? 0), 0))]),
    );

  it("lässt kleine Mengen unangetastet", () => {
    const per = [mk("a", 3), mk("b", 1)];
    expect(foldTopEpicSeries(per, 15)).toEqual(per);
  });

  it("zeigt die Top N nach Benefit einzeln und sammelt den Rest", () => {
    const per = Array.from({ length: 20 }, (_, i) => mk(`e${i}`, i));
    const folded = foldTopEpicSeries(per, 15);

    // 15 Einzelserien, absteigend nach Benefit, danach genau ein Sammler
    // (alle Rest-Epics sind hier freigegeben).
    expect(folded).toHaveLength(16);
    expect(folded.slice(0, 15).map((e) => e.id)).toEqual(
      ["e19", "e18", "e17", "e16", "e15", "e14", "e13", "e12", "e11", "e10"].concat([
        "e9",
        "e8",
        "e7",
        "e6",
        "e5",
      ]),
    );
    expect(folded[15]!.id).toBe(OTHERS_SERIES_ID);
    expect(folded[15]!.title).toBe("5 weitere Epics");
  });

  it("verliert kein Geld — die Monatssummen bleiben gleich", () => {
    const per = Array.from({ length: 20 }, (_, i) => mk(`e${i}`, i, i % 2 === 0));
    expect(totals(foldTopEpicSeries(per, 15))).toEqual(totals(per));
  });

  it("trennt den Rest nach Funding-Konfidenz — freigegeben vor veranschlagt", () => {
    // e0..e3 fallen aus den Top 2; zwei davon sind veranschlagt.
    const per = [
      mk("e0", 0, true),
      mk("e1", 1, false),
      mk("e2", 2, true),
      mk("e3", 3, false),
      mk("e4", 4, true),
      mk("e5", 5, true),
    ];
    const others = foldTopEpicSeries(per, 2).slice(2);
    expect(others.map((e) => e.id)).toEqual([OTHERS_SERIES_ID, `${OTHERS_SERIES_ID}:est`]);
    expect(others[0]!.hasAllocation).toBe(true);
    expect(others[1]!.hasAllocation).toBe(false);
    expect(others.map((e) => e.title)).toEqual(["2 weitere Epics", "2 weitere Epics"]);
  });

  it("legt kein :est-Band an, wenn alle Rest-Epics freigegeben sind", () => {
    const per = Array.from({ length: 5 }, (_, i) => mk(`e${i}`, i, true));
    const folded = foldTopEpicSeries(per, 2);
    expect(folded.map((e) => e.id)).toEqual(["e4", "e3", OTHERS_SERIES_ID]);
  });

  it("faltet nicht, wenn es keinen Stack spart", () => {
    // 3 Epics, topN = 2, Rest = 1 Epic ⇒ 2 + 1 = 3 Serien, also nichts gewonnen.
    const per = [mk("a", 3, true), mk("b", 2, false), mk("c", 1, true)];
    expect(foldTopEpicSeries(per, 2)).toEqual(per);
  });

  it("ist bei Gleichstand deterministisch (Id aufsteigend)", () => {
    const per = [mk("z", 5), mk("a", 5), mk("m", 5), mk("b", 9)];
    expect(
      foldTopEpicSeries(per, 2)
        .slice(0, 2)
        .map((e) => e.id),
    ).toEqual(["b", "a"]);
  });

  it("nennt ein einzelnes Rest-Epic im Singular", () => {
    // 6 Epics, topN = 2 ⇒ Rest = 4, davon drei freigegeben und **eines**
    // veranschlagt. 2 + 2 Bänder < 6, die Faltung greift also.
    const per = [
      mk("a", 6, true),
      mk("b", 5, true),
      mk("c", 4, true),
      mk("d", 3, true),
      mk("e", 2, true),
      mk("f", 1, false),
    ];
    const folded = foldTopEpicSeries(per, 2);
    expect(folded.map((e) => e.id)).toEqual([
      "a",
      "b",
      OTHERS_SERIES_ID,
      `${OTHERS_SERIES_ID}:est`,
    ]);
    expect(folded[2]!.title).toBe("3 weitere Epics");
    expect(folded[3]!.title).toBe("1 weiteres Epic");
  });
});
