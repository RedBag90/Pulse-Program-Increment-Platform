import { describe, it, expect } from "vitest";
import { buildStreamKpi, type ArtKpiRow } from "@/modules/budgeting/server/views/budget-kpis";
import type { ArtCoverage } from "@/modules/budgeting/domain/art-budget-model";
import type { JobSizeRate } from "@/modules/budgeting/domain/art-throughput";

/**
 * Die Wertstrom-Zeile der Budget-KPIs.
 *
 * Der Fehler, gegen den diese Tests stehen: aus zwei ART-Rechnungen **eine**
 * machen. Σ Job Size mal „dem Satz" gäbe eine plausible Zahl, die nichts
 * bedeutet — die Sätze sind je ART verschieden, und einen Wertstrom-Satz gibt
 * es nicht.
 */

const satz = (rate: number | null): JobSizeRate => ({
  rate,
  source: rate == null ? "none" : "empirical",
  cycles: [],
  budgetSum: 0,
  jobSizeSum: 0,
  featureCount: 0,
  standaloneJobSizeSum: 0,
  standaloneFeatureCount: 0,
  caveats: [],
});

const art = (name: string, over: Partial<ArtCoverage> = {}): ArtKpiRow => ({
  artId: name,
  name,
  coverage: {
    plannedJobSize: 0,
    featureCount: 0,
    plannedStandalone: { jobSize: 0, count: 0 },
    rate: satz(1_000),
    loadEuro: 0,
    allocated: 0,
    gap: 0,
    ...over,
  },
});

describe("buildStreamKpi", () => {
  it("summiert Last, Budget und Lücke über die ARTs", () => {
    const s = buildStreamKpi([
      art("A", { plannedJobSize: 180, featureCount: 31, loadEuro: 1_431_551, allocated: 236_050 }),
      art("B", { plannedJobSize: 455, featureCount: 74, loadEuro: 5_934_432, allocated: 238_750 }),
    ]);
    expect(s.plannedJobSize).toBe(635);
    expect(s.featureCount).toBe(105);
    expect(s.loadEuro).toBe(7_365_983);
    expect(s.allocated).toBe(474_800);
    expect(s.gap).toBe(6_891_183);
  });

  /**
   * **Ein ART ohne Satz fehlt in der Summe — und wird genannt.** Seine Last
   * stillschweigend als 0 zu zählen machte aus einer unvollständigen Rechnung
   * eine, die vollständig aussieht.
   */
  it("nennt die ARTs ohne Satz, statt ihre Last als 0 zu zählen", () => {
    const s = buildStreamKpi([
      art("Mit Satz", { plannedJobSize: 100, loadEuro: 500, allocated: 400 }),
      art("Ohne Satz", {
        plannedJobSize: 300,
        rate: satz(null),
        loadEuro: null,
        gap: null,
        allocated: 100,
      }),
    ]);
    expect(s.loadEuro).toBe(500);
    expect(s.withoutRate).toEqual(["Ohne Satz"]);
    // Das Budget des ARTs ohne Satz zählt sehr wohl mit: es ist zugeteilt.
    expect(s.allocated).toBe(500);
    // Und die Job Size auch — sie ist gemessen, nur nicht in Geld umrechenbar.
    expect(s.plannedJobSize).toBe(400);
  });

  it("gibt keine Last aus, wenn kein einziges ART einen Satz hat", () => {
    const s = buildStreamKpi([
      art("A", { rate: satz(null), loadEuro: null, gap: null, allocated: 100 }),
      art("B", { rate: satz(null), loadEuro: null, gap: null, allocated: 50 }),
    ]);
    expect(s.loadEuro).toBeNull();
    expect(s.gap).toBeNull();
    expect(s.withoutRate).toEqual(["A", "B"]);
  });

  it("verträgt einen Wertstrom ohne ART", () => {
    const s = buildStreamKpi([]);
    expect(s).toMatchObject({ plannedJobSize: 0, allocated: 0, loadEuro: null, gap: null });
  });
});
