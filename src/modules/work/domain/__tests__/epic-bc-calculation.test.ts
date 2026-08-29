import { describe, it, expect } from "vitest";
import { buildEpicBusinessCaseCalc, type BcCalcInput } from "../epic-bc-calculation";

// Nachgebildet aus dem echten Seed-Epic „TMS — Region West" (L4).
const base: BcCalcInput = {
  createdAt: new Date("2024-10-01T00:00:00Z"),
  selectedForDetailingAt: new Date("2024-11-30T00:00:00Z"),
  hypothesisApprovedAt: new Date("2024-12-10T00:00:00Z"),
  selectedForAnalyzingAt: null,
  businessCaseApprovedAt: new Date("2025-01-09T00:00:00Z"),
  implementationStartedAt: new Date("2025-01-29T00:00:00Z"),
  impactRecognizedAt: null,
  plannedEndAt: new Date("2025-08-07T00:00:00Z"),
  timeline: {
    actuals: {},
    estimates: { implementation_started: "2025-01-29", implementation: "2025-08-07" },
  },
  businessCase: { costSlices: [{ amount: 48000 }, { amount: 33500 }] },
  allocatedByPeriod: { "2025-H1": 104000 },
  kpis: [
    {
      id: "k1",
      name: "Kosteneinsparung",
      baseline: 0,
      target: 288000,
      valuePerUnit: 1,
      benefitKind: "recurring",
      recurringInterval: "yearly",
      benefitWeight: null,
      measurements: [
        { date: "2025-05-04", value: 22578 },
        { date: "2026-02-28", value: 172800 },
      ],
    },
  ],
  now: new Date("2026-03-01T00:00:00Z"),
};

const at = (rows: { day: string }[], day: string) => rows.find((r) => r.day === day);
const monthSum = (rows: { day: string; costPerDay: number }[], ym: string) =>
  rows.filter((r) => r.day.startsWith(ym)).reduce((a, r) => a + r.costPerDay, 0);

describe("buildEpicBusinessCaseCalc", () => {
  it("Allocation treibt die Kosten (Σ = Allocation; Monatswert = Allocation/6)", () => {
    const { rows, summary } = buildEpicBusinessCaseCalc(base);
    expect(summary.hasAllocation).toBe(true);
    expect(Math.round(summary.totalCost)).toBe(104_000);
    // Tageswert = Monatswert (104000/6) ÷ Kalendertage des Monats — deckungsgleich
    // mit dem Portfolio-Dashboard (nicht mehr die alte 181-Tage-Gleichverteilung).
    expect(at(rows, "2025-03-15")!.costPerDay).toBeCloseTo(104_000 / 6 / 31, 2);
    expect(at(rows, "2025-07-15")!.costPerDay).toBe(0); // nach Jun 2025 keine Kosten
  });

  it("Monats-Summe der Tage = App-Monatswert (Allocation/6 je H1-Monat)", () => {
    const { rows } = buildEpicBusinessCaseCalc(base);
    for (const ym of ["2025-01", "2025-02", "2025-03", "2025-06"]) {
      expect(monthSum(rows, ym)).toBeCloseTo(104_000 / 6, 6);
    }
  });

  it("Ohne Allocation: veranschlagt, Kosten aus den costSlices", () => {
    const { summary } = buildEpicBusinessCaseCalc({ ...base, allocatedByPeriod: {} });
    expect(summary.hasAllocation).toBe(false);
    expect(Math.round(summary.totalCost)).toBe(48_000 + 33_500);
  });

  it("Reifegrad folgt den Stempeln: L0 → L1 → L2 → L4 (L3 übersprungen)", () => {
    const { rows } = buildEpicBusinessCaseCalc(base);
    expect(at(rows, "2024-11-01")!.gate).toBe("L0");
    expect(at(rows, "2024-12-01")!.gate).toBe("L1");
    expect(at(rows, "2025-01-15")!.gate).toBe("L2");
    expect(at(rows, "2025-02-01")!.gate).toBe("L4");
  });

  it("Recurring Benefit: Forecast-Monat = Vollrate (Jahreswert/12 ÷ Monatstage)", () => {
    const { rows } = buildEpicBusinessCaseCalc(base);
    // 2026-04 liegt hinter „heute" (2026-03) ⇒ Forecast, volle Run-Rate @Ziel.
    expect(at(rows, "2026-04-15")!.isForecast).toBe(true);
    expect(at(rows, "2026-04-15")!.benefitPerDay).toBeCloseTo(288_000 / 12 / 30, 2);
  });

  it("Break-even wird erreicht", () => {
    const { summary } = buildEpicBusinessCaseCalc(base);
    expect(summary.breakEvenDay).not.toBeNull();
  });

  it("createdAt in der Zukunft bricht die Timeline nicht (L0-Start = frühestes Datum)", () => {
    const { rows } = buildEpicBusinessCaseCalc({
      ...base,
      createdAt: new Date("2026-08-29T00:00:00Z"), // Seed-Artefakt
    });
    // erster Tag ist die früheste Transition (Detailing), nicht das Zukunfts-createdAt
    expect(rows[0]!.day).toBe("2024-11-30");
    expect(at(rows, "2025-02-01")!.gate).toBe("L4");
  });
});
