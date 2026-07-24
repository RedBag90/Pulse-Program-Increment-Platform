import { describe, it, expect } from "vitest";
import {
  kpiAchievement,
  kpiTrio,
  keyResultTrio,
  sumTrios,
  epicLinkTrio,
  nodeProgress,
  nodeTrio,
  isAtRisk,
  horizonShare,
  keyResultProgress,
  rollupObjectiveProgress,
} from "@/domain/goals-rollup";
import type { KpiInput, RollupNode, RollupTrio } from "@/domain/goals-rollup";

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

describe("epicLinkTrio", () => {
  const kpi = (id: string, over: Partial<KpiInput> = {}): KpiInput => ({
    id,
    baseline: 0,
    target: 100,
    current: 50,
    valuePerUnit: 10,
    ...over,
  });

  it("returns a zero trio for no links", () => {
    expect(epicLinkTrio([], 1)).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });

  it("returns a zero trio for an epic with no KPIs", () => {
    expect(epicLinkTrio([{ epicId: "e1", kpis: [] }], 1)).toEqual({
      planned: 0,
      realized: 0,
      runRate: 0,
    });
  });

  it("sums a single epic's KPI trio (whole epic, no weighting)", () => {
    // span 100 × vpu 10 = 1000 planned; 50% achievement × full horizon = 500 realized
    expect(epicLinkTrio([{ epicId: "e1", kpis: [kpi("k1")] }], 1)).toEqual({
      planned: 1000,
      realized: 500,
      runRate: 500,
    });
  });

  it("aggregates multiple epics and multiple KPIs", () => {
    const trio = epicLinkTrio(
      [
        { epicId: "e1", kpis: [kpi("k1"), kpi("k2")] },
        { epicId: "e2", kpis: [kpi("k3")] },
      ],
      1,
    );
    expect(trio.planned).toBe(3000);
    expect(trio.realized).toBe(1500);
  });

  it("scales realized by horizon share and matches keyResultTrio at weight 1", () => {
    const k = kpi("k1");
    const linkTrio = epicLinkTrio([{ epicId: "e1", kpis: [k] }], 0.5);
    const boundTrio = keyResultTrio(
      [{ kpiId: "k1", weight: 1, valuePerUnitOverride: null }],
      new Map([["k1", k]]),
      0.5,
    );
    expect(linkTrio).toEqual(boundTrio);
    expect(linkTrio.realized).toBe(250);
  });
});

describe("nodeProgress / nodeTrio (recursive cascade)", () => {
  const ZERO: RollupTrio = { planned: 0, realized: 0, runRate: 0 };
  const leaf = (progress: number | null, over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    mode: "manual",
    progressLeaf: progress,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children: [],
    ...over,
  });
  const branch = (children: RollupNode[], over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    mode: "rollup",
    progressLeaf: null,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children,
    ...over,
  });

  it("leaf progress is its own progressLeaf", () => {
    expect(nodeProgress(leaf(0.4))).toBe(0.4);
    expect(nodeProgress(leaf(null))).toBeNull();
  });

  it("branch progress is the weighted average of children", () => {
    expect(nodeProgress(branch([leaf(0.2), leaf(0.8)]))).toBeCloseTo(0.5);
    expect(nodeProgress(branch([leaf(0, { weight: 3 }), leaf(1, { weight: 1 })]))).toBeCloseTo(
      0.25,
    );
  });

  it("excludes null-progress children from the average", () => {
    expect(nodeProgress(branch([leaf(0.6), leaf(null)]))).toBeCloseTo(0.6);
  });

  it("returns null when a branch has only null children", () => {
    expect(nodeProgress(branch([leaf(null), branch([leaf(null)])]))).toBeNull();
  });

  it("rolls up three levels deep", () => {
    // root → [midA(0.5 avg), leaf 1.0]  → (0.5 + 1.0)/2 = 0.75
    const midA = branch([leaf(0.25), leaf(0.75)]); // 0.5
    expect(nodeProgress(branch([midA, leaf(1)]))).toBeCloseTo(0.75);
  });

  it("manual/auto_kpi mode uses own progressLeaf even with children (override)", () => {
    // A node explicitly set to manual keeps its own progressLeaf, ignoring the
    // children rollup that would otherwise average to 0.5.
    const node = branch([leaf(0.2), leaf(0.8)], { mode: "manual", progressLeaf: 0.9 });
    expect(nodeProgress(node)).toBeCloseTo(0.9);
    const auto = branch([leaf(0.2), leaf(0.8)], { mode: "auto_kpi", progressLeaf: 0.3 });
    expect(nodeProgress(auto)).toBeCloseTo(0.3);
  });

  it("rollup mode with no children returns null", () => {
    expect(nodeProgress(leaf(0.5, { mode: "rollup", children: [] }))).toBeNull();
  });

  it("nodeTrio sums leaf trios up the tree plus epic links at each level", () => {
    const t = (planned: number): RollupTrio => ({
      planned,
      realized: planned / 2,
      runRate: planned,
    });
    const l1 = leaf(1, { trioLeaf: t(100) });
    const l2 = leaf(1, { trioLeaf: t(200), trioEpicLinks: t(50) });
    const root = branch([l1, l2], { trioEpicLinks: t(10) });
    const trio = nodeTrio(root);
    // 100 + 200 + 50 (l2 link) + 10 (root link) = 360 planned
    expect(trio.planned).toBe(360);
    expect(trio.realized).toBe(180);
  });

  it("a branch ignores its own leaf trio in favour of children", () => {
    const root = branch([leaf(1, { trioLeaf: { planned: 100, realized: 100, runRate: 100 } })], {
      trioLeaf: { planned: 999, realized: 999, runRate: 999 },
    });
    expect(nodeTrio(root).planned).toBe(100);
  });
});
