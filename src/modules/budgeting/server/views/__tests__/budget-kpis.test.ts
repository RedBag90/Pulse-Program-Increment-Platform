import { describe, it, expect } from "vitest";
import { jobSizeBurn, halfYearWindow } from "@/modules/budgeting/domain/job-size-burn";
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
  artEstimate: null,
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
    plannedByBucket: {
      business: { count: 0, jobSize: 0 },
      enabler: { count: 0, jobSize: 0 },
      maintenance: { count: 0, jobSize: 0 },
    },
    plannedUnclassified: { count: 0, jobSize: 0 },
    rate: satz(1_000),
    loadEuro: 0,
    allocated: 0,
    gap: 0,
    burn: jobSizeBurn({
      window: halfYearWindow("2026-H2"),
      allocated: 0,
      rate: null,
      completions: [],
      today: new Date("2026-09-01T00:00:00Z"),
    }),
    cycleCompletions: [],
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

describe("buildStreamKpi — der Job-Size-Verlauf des Wertstroms", () => {
  const heute = new Date("2026-10-01T00:00:00Z");
  const mit = (name: string, allocated: number, rate: number | null, js: number) => {
    const cycleCompletions = [{ at: new Date("2026-09-01T00:00:00Z"), jobSize: js }];
    return art(name, {
      rate: satz(rate),
      loadEuro: rate == null ? null : 0,
      allocated,
      cycleCompletions,
      burn: jobSizeBurn({
        window: halfYearWindow("2026-H2"),
        allocated,
        rate,
        completions: cycleCompletions,
        today: heute,
      }),
    });
  };

  it("Σ der ARTs mit Satz — das ART ohne Satz fehlt in Plan und Ist und wird genannt", () => {
    const s = buildStreamKpi(
      [mit("A", 300_000, 3_000, 40), mit("B", 100_000, 1_000, 30), mit("C", 500_000, null, 99)],
      halfYearWindow("2026-H2"),
      heute,
    );
    expect(s.burn!.expected).toBe(200);
    expect(s.burn!.actualToday).toBe(70);
    expect(s.withoutRate).toEqual(["C"]);
  });
});

describe("loadBudgetKpis — der Verlauf nimmt das Geld der Kachel", () => {
  it("der ART-Verlauf rechnet mit allocatedByCycle[kachel.cycleKey], nicht mit dem Umschalter", async () => {
    // loadArtCoverage liest nur zwei Dinge aus der DB: Features und Tenant-Einstellungen.
    const db = {
      initiative: { findMany: async () => [] },
      tenant: { findUnique: async () => ({ costPerJobSizePoint: 1_000 }) },
      // Die Schätzung des ARTs — hier keine; der Mandanten-Satz greift.
      art: { findFirst: async () => ({ jobSizeRateEstimate: null }) },
      tenantBudgetSettings: { findUnique: async () => null },
    };
    const { loadArtCoverage } = await import("@/modules/budgeting/server/services/art-coverage");
    const c = await loadArtCoverage(
      db as never,
      "t1" as never,
      "a1",
      "2027-H1", // der Umschalter steht auf dem nächsten Halbjahr
      { "2026-H2": 100_000, "2027-H1": 900_000 },
      new Date("2026-10-01T00:00:00Z"),
      {
        cycleKey: "2026-H2",
        start: new Date("2026-07-06T00:00:00Z"),
        end: new Date("2027-01-01T00:00:00Z"),
        extended: false,
      },
    );
    expect(c.allocated).toBe(900_000); // die Karte folgt dem Umschalter
    expect(c.burn?.expected).toBe(100); // der Verlauf der Kachel: 100.000 € ÷ 1.000 €/JS
  });
});
