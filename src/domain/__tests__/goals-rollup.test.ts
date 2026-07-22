import { describe, it, expect } from "vitest";
import {
  kpiAchievement,
  kpiTrio,
  keyResultTrio,
  sumTrios,
  isAtRisk,
  horizonShare,
  keyResultProgress,
  rollupObjectiveProgress,
} from "@/domain/goals-rollup";

describe("kpiAchievement", () => {
  it("returns 0 when baseline/target/current are missing", () => {
    expect(
      kpiAchievement({ id: "k", baseline: null, target: 10, current: 5, valuePerUnit: 1 }),
    ).toBe(0);
  });

  it("returns 0.5 at the midpoint baseline → target", () => {
    expect(
      kpiAchievement({ id: "k", baseline: 0, target: 100, current: 50, valuePerUnit: 1 }),
    ).toBe(0.5);
  });

  it("clamps below 0 and above 1", () => {
    expect(
      kpiAchievement({ id: "k", baseline: 0, target: 100, current: -10, valuePerUnit: 1 }),
    ).toBe(0);
    expect(
      kpiAchievement({ id: "k", baseline: 0, target: 100, current: 150, valuePerUnit: 1 }),
    ).toBe(1);
  });

  it("handles inverted scales (target < baseline): halbe Strecke = 0.5", () => {
    // baseline 100, target 0 (kleiner ist besser, z. B. Bug-Anzahl).
    // current 50 = exakt auf der Mitte → 0.5
    expect(
      kpiAchievement({ id: "k", baseline: 100, target: 0, current: 50, valuePerUnit: 1 }),
    ).toBe(0.5);
  });
});

describe("kpiTrio", () => {
  const kpi = { id: "k", baseline: 0, target: 100, current: 50, valuePerUnit: 200 };

  it("planned = span × valuePerUnit", () => {
    const t = kpiTrio(kpi, 1);
    expect(t.planned).toBe(20_000);
  });

  it("realized = achievement × planned × horizonShare", () => {
    // 50% achievement, full horizon → realized = 0.5 × 20_000 × 1 = 10_000
    const t = kpiTrio(kpi, 1);
    expect(t.realized).toBe(10_000);
  });

  it("run-rate hochrechnet auf gesamten horizont", () => {
    // 50% achievement, 25% des Horizont verstrichen → realized = 2_500, run-rate = 10_000
    const t = kpiTrio(kpi, 0.25);
    expect(t.realized).toBe(2_500);
    expect(t.runRate).toBe(10_000);
  });

  it("yields 0 when valuePerUnit ist null", () => {
    const t = kpiTrio({ ...kpi, valuePerUnit: null }, 1);
    expect(t).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });
});

describe("keyResultTrio", () => {
  const npsMobile = { id: "k1", baseline: 30, target: 50, current: 35, valuePerUnit: 10_000 };
  const npsWeb = { id: "k2", baseline: 25, target: 45, current: 30, valuePerUnit: 10_000 };
  const byId = new Map([
    [npsMobile.id, npsMobile],
    [npsWeb.id, npsWeb],
  ]);

  it("aggregiert mit weights", () => {
    // npsMobile: span 20 × 10k = 200k planned. achievement (35-30)/20 = 0.25 → realized 50k.
    // npsWeb:    span 20 × 10k = 200k planned. achievement (30-25)/20 = 0.25 → realized 50k.
    // contributions: 60% / 40% → planned 200k, realized 50k
    const t = keyResultTrio(
      [
        { kpiId: "k1", weight: 0.6, valuePerUnitOverride: null },
        { kpiId: "k2", weight: 0.4, valuePerUnitOverride: null },
      ],
      byId,
      1,
    );
    expect(t.planned).toBe(200_000); // 0.6*200k + 0.4*200k
    expect(t.realized).toBe(50_000); // 0.6*50k + 0.4*50k
  });

  it("override schlaegt KPI-valuePerUnit ueber", () => {
    const t = keyResultTrio([{ kpiId: "k1", weight: 1, valuePerUnitOverride: 5_000 }], byId, 1);
    // planned = 20 × 5_000 × 1 = 100k
    expect(t.planned).toBe(100_000);
  });

  it("ueberspringt fehlende KPIs", () => {
    const t = keyResultTrio([{ kpiId: "unknown", weight: 1, valuePerUnitOverride: null }], byId, 1);
    expect(t).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });
});

describe("sumTrios", () => {
  it("summiert komponentenweise", () => {
    const s = sumTrios([
      { planned: 100, realized: 50, runRate: 80 },
      { planned: 200, realized: 80, runRate: 120 },
    ]);
    expect(s).toEqual({ planned: 300, realized: 130, runRate: 200 });
  });

  it("leere Liste = Nullen", () => {
    expect(sumTrios([])).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });
});

describe("isAtRisk", () => {
  it("at-risk wenn Run-Rate < 70 % Planned", () => {
    expect(isAtRisk({ planned: 1000, realized: 200, runRate: 600 })).toBe(true);
  });

  it("nicht at-risk wenn Run-Rate >= 70 %", () => {
    expect(isAtRisk({ planned: 1000, realized: 500, runRate: 700 })).toBe(false);
    expect(isAtRisk({ planned: 1000, realized: 800, runRate: 1000 })).toBe(false);
  });

  it("nicht at-risk wenn planned <= 0", () => {
    expect(isAtRisk({ planned: 0, realized: 0, runRate: 0 })).toBe(false);
  });

  it("Schwelle ist konfigurierbar", () => {
    expect(isAtRisk({ planned: 1000, realized: 500, runRate: 750 }, 0.8)).toBe(true);
  });
});

describe("horizonShare", () => {
  const start = new Date("2024-01-01");
  const end = new Date("2027-01-01");

  it("vor Start = 0", () => {
    expect(horizonShare(new Date("2023-06-01"), start, end)).toBe(0);
  });

  it("nach Ende = 1", () => {
    expect(horizonShare(new Date("2028-01-01"), start, end)).toBe(1);
  });

  it("auf der Mitte ~0.5", () => {
    expect(horizonShare(new Date("2025-07-02"), start, end)).toBeCloseTo(0.5, 2);
  });

  it("degenerate range = 0", () => {
    expect(horizonShare(new Date("2025-01-01"), end, start)).toBe(0);
  });
});

describe("keyResultProgress", () => {
  it("normalises current within baseline→target", () => {
    expect(keyResultProgress({ baseline: 0, target: 4, current: 2 })).toBe(0.5);
    expect(keyResultProgress({ baseline: 10, target: 20, current: 15 })).toBe(0.5);
  });

  it("clamps below 0 and above 1", () => {
    expect(keyResultProgress({ baseline: 0, target: 10, current: -5 })).toBe(0);
    expect(keyResultProgress({ baseline: 0, target: 10, current: 99 })).toBe(1);
  });

  it("missing values → 0", () => {
    expect(keyResultProgress({ baseline: null, target: 10, current: 5 })).toBe(0);
    expect(keyResultProgress({ baseline: 0, target: null, current: 5 })).toBe(0);
    expect(keyResultProgress({ baseline: 0, target: 10, current: null })).toBe(0);
  });

  it("zero span → 1 iff current already at target, else 0", () => {
    expect(keyResultProgress({ baseline: 5, target: 5, current: 5 })).toBe(1);
    expect(keyResultProgress({ baseline: 5, target: 5, current: 3 })).toBe(0);
  });
});

describe("rollupObjectiveProgress", () => {
  it("null when there are no key results", () => {
    expect(rollupObjectiveProgress([])).toBeNull();
  });

  it("arithmetic mean without weights", () => {
    expect(rollupObjectiveProgress([0, 1])).toBe(0.5);
    expect(rollupObjectiveProgress([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 10);
  });

  it("clamps each input into 0..1 before averaging", () => {
    expect(rollupObjectiveProgress([-1, 2])).toBe(0.5);
  });

  it("weighted average", () => {
    // 0.6·1 + 0.4·0 = 0.6
    expect(rollupObjectiveProgress([1, 0], [0.6, 0.4])).toBeCloseTo(0.6, 10);
  });

  it("equal weights == unweighted (Epic 3 backward-compatible)", () => {
    expect(rollupObjectiveProgress([1, 0, 0.5], [2, 2, 2])).toBe(
      rollupObjectiveProgress([1, 0, 0.5]),
    );
  });

  it("mismatched weight length falls back to mean", () => {
    expect(rollupObjectiveProgress([1, 0], [1])).toBe(0.5);
  });

  it("zero total weight falls back to mean", () => {
    expect(rollupObjectiveProgress([1, 0], [0, 0])).toBe(0.5);
  });
});
