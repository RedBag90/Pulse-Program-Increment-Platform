import { describe, it, expect } from "vitest";

import {
  deriveJobSizeRate,
  loadInEuro,
  THIN_JOB_SIZE,
  type ThroughputCycle,
} from "@/modules/budgeting/domain/art-throughput";

const cycle = (
  cycleKey: string,
  budget: number,
  jobSize: number,
  featureCount = 10,
): ThroughputCycle => ({
  cycleKey,
  budget,
  jobSize,
  featureCount,
});

const input = (over: Partial<Parameters<typeof deriveJobSizeRate>[0]> = {}) => ({
  cycles: [],
  tenantDefault: null,
  undatedFeatures: 0,
  placeholderJobSize: 0,
  ...over,
});

describe("deriveJobSizeRate", () => {
  it("rechnet den Satz aus Budget und Punkten der letzten zwei Zyklen", () => {
    const r = deriveJobSizeRate(
      input({
        cycles: [cycle("2025-H2", 1_000_000, 100), cycle("2026-H1", 1_200_000, 100)],
      }),
    );
    expect(r.source).toBe("empirical");
    // Ø Budget 1.100.000 ÷ Ø Punkte 100 = 11.000 €/Punkt
    expect(r.rate).toBe(11_000);
    expect(r.budgetSum).toBe(2_200_000);
    expect(r.jobSizeSum).toBe(200);
  });

  it("nimmt die beiden jüngsten Zyklen, nicht die ersten", () => {
    const r = deriveJobSizeRate(
      input({
        cycles: [
          cycle("2024-H1", 999_999, 1),
          cycle("2025-H2", 1_000_000, 100),
          cycle("2026-H1", 1_000_000, 100),
        ],
      }),
    );
    expect(r.cycles.map((c) => c.cycleKey)).toEqual(["2026-H1", "2025-H2"]);
    expect(r.rate).toBe(10_000);
  });

  it("fällt ohne Abschlüsse auf den Tenant-Wert zurück", () => {
    const r = deriveJobSizeRate(
      input({ cycles: [cycle("2026-H1", 500_000, 0, 0)], tenantDefault: 1_800 }),
    );
    expect(r.source).toBe("tenantDefault");
    expect(r.rate).toBe(1_800);
    expect(r.caveats[0]).toContain("nichts fertiggestellt");
  });

  it("fällt ohne Zyklen auf den Tenant-Wert zurück und sagt warum", () => {
    const r = deriveJobSizeRate(input({ tenantDefault: 600 }));
    expect(r.source).toBe("tenantDefault");
    expect(r.caveats[0]).toContain("Kein abgeschlossener Zyklus");
  });

  // Lieber keine Zahl als eine erfundene.
  it("liefert keinen Satz, wenn auch der Tenant-Wert fehlt", () => {
    const r = deriveJobSizeRate(input());
    expect(r.source).toBe("none");
    expect(r.rate).toBeNull();
  });

  it("kennzeichnet einen dünnen Nenner", () => {
    const r = deriveJobSizeRate(
      input({ cycles: [cycle("2025-H2", 500_000, 30), cycle("2026-H1", 500_000, 28)] }),
    );
    expect(r.source).toBe("empirical");
    expect(r.jobSizeSum).toBeLessThan(THIN_JOB_SIZE);
    expect(r.caveats.join(" ")).toContain("schwankt");
  });

  it("kennzeichnet einen einzelnen Zyklus als vorläufig", () => {
    const r = deriveJobSizeRate(input({ cycles: [cycle("2026-H1", 1_000_000, 200)] }));
    expect(r.caveats.join(" ")).toContain("vorläufig");
  });

  it("nennt fehlende Abschlussdaten und Platzhalter-Punkte", () => {
    const r = deriveJobSizeRate(
      input({
        cycles: [cycle("2025-H2", 500_000, 200), cycle("2026-H1", 500_000, 200)],
        undatedFeatures: 11,
        placeholderJobSize: 18,
      }),
    );
    expect(r.caveats.join(" ")).toContain("11 abgeschlossene Features ohne Abschlussdatum");
    expect(r.caveats.join(" ")).toContain("18 Features tragen Job Size 3");
  });
});

describe("loadInEuro", () => {
  it("rechnet Punkte in Geld, wenn ein Satz vorliegt", () => {
    const r = deriveJobSizeRate(
      input({ cycles: [cycle("2025-H2", 1_000_000, 100), cycle("2026-H1", 1_000_000, 100)] }),
    );
    expect(loadInEuro(142, r)).toBe(142 * 10_000);
  });

  it("bleibt ohne Satz null, statt eine Zahl zu erfinden", () => {
    expect(loadInEuro(142, deriveJobSizeRate(input()))).toBeNull();
  });
});
