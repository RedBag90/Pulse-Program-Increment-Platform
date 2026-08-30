import { describe, it, expect } from "vitest";
import {
  kpiAchievement,
  kpiTrio,
  sumTrios,
  epicLinkTrio,
  nodeProgress,
  nodeTrio,
  isAtRisk,
  keyResultProgress,
  rollupObjectiveProgress,
  epicSuccessKpiContribution,
  nodeUnitValue,
  epicTopGoalBenefits,
  epicGoalBenefitsPerNode,
  epicCascadeBreakdown,
} from "@/modules/core/goals/domain/goals-rollup";
import type {
  KpiInput,
  RollupNode,
  RollupTrio,
  GoalNodeMeta,
  EpicGoalLinkInput,
} from "@/modules/core/goals/domain/goals-rollup";

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
    const t = kpiTrio(kpi);
    expect(t.planned).toBe(20_000);
  });

  it("realized = achievement × planned (voller KPI-Wert, kein Horizont)", () => {
    // 50% achievement → realized = 0.5 × 20_000 = 10_000; runRate = realized
    const t = kpiTrio(kpi);
    expect(t.realized).toBe(10_000);
    expect(t.runRate).toBe(10_000);
  });

  it("100% achievement → realized = planned", () => {
    const t = kpiTrio({ ...kpi, current: 100 });
    expect(t.realized).toBe(20_000);
    expect(t.planned).toBe(20_000);
  });

  it("yields 0 when valuePerUnit ist null", () => {
    const t = kpiTrio({ ...kpi, valuePerUnit: null });
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
    expect(epicLinkTrio([])).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });

  it("returns a zero trio for an epic with no KPIs", () => {
    expect(epicLinkTrio([{ epicId: "e1", kpis: [] }])).toEqual({
      planned: 0,
      realized: 0,
      runRate: 0,
    });
  });

  it("sums a single epic's KPI trio (whole epic, no weighting)", () => {
    // span 100 × vpu 10 = 1000 planned; 50% achievement = 500 realized (voller Wert)
    expect(epicLinkTrio([{ epicId: "e1", kpis: [kpi("k1")] }])).toEqual({
      planned: 1000,
      realized: 500,
      runRate: 500,
    });
  });

  it("aggregates multiple epics and multiple KPIs", () => {
    const trio = epicLinkTrio([
      { epicId: "e1", kpis: [kpi("k1"), kpi("k2")] },
      { epicId: "e2", kpis: [kpi("k3")] },
    ]);
    expect(trio.planned).toBe(3000);
    expect(trio.realized).toBe(1500);
  });

  it("summiert den vollen KPI-Wert (weight-frei)", () => {
    const linkTrio = epicLinkTrio([{ epicId: "e1", kpis: [kpi("k1")] }]);
    expect(linkTrio.realized).toBe(500);
  });
});

describe("nodeProgress / nodeTrio (recursive cascade)", () => {
  const ZERO: RollupTrio = { planned: 0, realized: 0, runRate: 0 };
  const leaf = (progress: number | null, over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    includeInRollup: true,
    mode: "manual",
    progressLeaf: progress,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children: [],
    ...over,
  });
  const branch = (children: RollupNode[], over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    includeInRollup: true,
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

  it("manual mode uses own progressLeaf even with children (override)", () => {
    // A node explicitly set to manual keeps its own progressLeaf, ignoring the
    // children rollup that would otherwise average to 0.5.
    const node = branch([leaf(0.2), leaf(0.8)], { mode: "manual", progressLeaf: 0.9 });
    expect(nodeProgress(node)).toBeCloseTo(0.9);
  });

  it("kpi_tree aggregiert mit Kindern (Ast = Ø), aber nutzt progressLeaf ohne Kinder (Blatt)", () => {
    // Ast: kpi_tree mit Kindern mittelt (der wert-basierte Override sitzt im Loader).
    const ast = branch([leaf(0.2), leaf(0.8)], { mode: "kpi_tree", progressLeaf: 0.99 });
    expect(nodeProgress(ast)).toBeCloseTo(0.5);
    // Blatt: kpi_tree ohne Kinder nutzt den eigenen progressLeaf.
    expect(nodeProgress(leaf(0.4, { mode: "kpi_tree" }))).toBeCloseTo(0.4);
  });

  it("rollup mode with no children returns null", () => {
    expect(nodeProgress(leaf(0.5, { mode: "rollup", children: [] }))).toBeNull();
  });

  it("excludes includeInRollup=false children from progress and trio", () => {
    // B (1.0) is excluded ⇒ average is just A (0.0), not 0.5.
    expect(nodeProgress(branch([leaf(0), leaf(1, { includeInRollup: false })]))).toBeCloseTo(0);
    // Same for €: the excluded leaf's trioLeaf drops out of the branch sum.
    const t = (planned: number): RollupTrio => ({ planned, realized: planned, runRate: planned });
    const root = branch([
      leaf(1, { trioLeaf: t(100) }),
      leaf(1, { trioLeaf: t(999), includeInRollup: false }),
    ]);
    expect(nodeTrio(root).planned).toBe(100);
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

// ── Einheiten-Kaskade (Unit→Unit) ───────────────────────────────────────────

describe("epicSuccessKpiContribution", () => {
  const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
    id: "k",
    baseline: 0,
    target: 10,
    current: 4,
    valuePerUnit: null,
    ...over,
  });

  it("one_time: planned = span×factor, realized = kpiDelta×factor", () => {
    const t = epicSuccessKpiContribution(kpi(), 10000, "one_time", "yearly");
    expect(t.planned).toBe(100000); // |10−0| × 10000
    expect(t.realized).toBe(40000); // (4−0) × 10000
    expect(t.runRate).toBe(40000);
  });

  it("recurring monthly annualises ×12", () => {
    const t = epicSuccessKpiContribution(
      kpi({ target: 10, current: 5 }),
      1000,
      "recurring",
      "monthly",
    );
    expect(t.planned).toBe(120000); // 10 × 1000 × 12
    expect(t.realized).toBe(60000); // 5 × 1000 × 12
  });

  it("recurring yearly is ×1", () => {
    const t = epicSuccessKpiContribution(kpi(), 1000, "recurring", "yearly");
    expect(t.planned).toBe(10000);
  });

  it("null or zero factor ⇒ zero trio", () => {
    expect(epicSuccessKpiContribution(kpi(), null, "one_time", "yearly")).toEqual({
      planned: 0,
      realized: 0,
      runRate: 0,
    });
    expect(epicSuccessKpiContribution(kpi(), 0, "one_time", "yearly").planned).toBe(0);
  });

  it("inverted scale (lower is better) yields positive movement", () => {
    // baseline 100 → target 0 (fewer defects), current 60 = 40 saved.
    const t = epicSuccessKpiContribution(
      kpi({ baseline: 100, target: 0, current: 60 }),
      50,
      "one_time",
      "yearly",
    );
    expect(t.planned).toBe(5000); // |0−100| × 50
    expect(t.realized).toBe(2000); // 40 × 50
  });
});

describe("nodeUnitValue (unit cascade)", () => {
  const ZERO: RollupTrio = { planned: 0, realized: 0, runRate: 0 };
  const t = (planned: number, realized = planned): RollupTrio => ({
    planned,
    realized,
    runRate: realized,
  });
  const leaf = (over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    includeInRollup: true,
    mode: "manual",
    progressLeaf: null,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children: [],
    unitValueLeaf: ZERO,
    unitEpicLinks: ZERO,
    childUnitFactor: null,
    ...over,
  });
  const branch = (children: RollupNode[], over: Partial<RollupNode> = {}): RollupNode => ({
    weight: 1,
    includeInRollup: true,
    mode: "rollup",
    progressLeaf: null,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children,
    unitValueLeaf: ZERO,
    unitEpicLinks: ZERO,
    childUnitFactor: null,
    ...over,
  });

  it("Wagen example: child in 'Wagen' rolls into '€' parent via childUnitFactor", () => {
    // child measures wagons: value 10 planned / 4 realized; 10000 €/Wagon.
    const child = leaf({ unitValueLeaf: t(10, 4), childUnitFactor: 10000 });
    const parent = branch([child]); // parent unit = €
    const v = nodeUnitValue(parent);
    expect(v.planned).toBe(100000); // 10 × 10000
    expect(v.realized).toBe(40000); // 4 × 10000
  });

  it("adds the node's own epic-link contributions in its own unit", () => {
    const child = leaf({ unitValueLeaf: t(1), childUnitFactor: 1000 });
    const parent = branch([child], { unitEpicLinks: t(500) });
    expect(nodeUnitValue(parent).planned).toBe(1500); // 1×1000 + 500
  });

  it("null childUnitFactor breaks the child's contribution to 0", () => {
    const child = leaf({ unitValueLeaf: t(10), childUnitFactor: null });
    expect(nodeUnitValue(branch([child])).planned).toBe(0);
  });

  it("manual mode with children: own leaf wins (decoupled from epic rollup)", () => {
    const child = leaf({ unitValueLeaf: t(999), childUnitFactor: 1 });
    const manual = branch([child], { mode: "manual", unitValueLeaf: t(42) });
    expect(nodeUnitValue(manual).planned).toBe(42);
  });

  it("kpi_tree-Ast kaskadiert die Kinder-Werte (wie rollup)", () => {
    const child = leaf({ unitValueLeaf: t(10, 4), childUnitFactor: 16000 });
    const ast = branch([child], { mode: "kpi_tree" });
    expect(nodeUnitValue(ast).planned).toBe(160000); // 10 × 16000
    expect(nodeUnitValue(ast).realized).toBe(64000); // 4 × 16000
  });

  it("kpi_tree-Blatt nutzt das eigene unitValueLeaf (keine Kaskade)", () => {
    const blatt = leaf({ mode: "kpi_tree", unitValueLeaf: t(62, 25) });
    expect(nodeUnitValue(blatt)).toEqual(t(62, 25));
  });

  it("€-equivalence lock: factor=1 currency tree ⇒ nodeUnitValue === nodeTrio", () => {
    // Mirror leaf/branch trios into the unit fields with childUnitFactor 1.
    const mkLeaf = (planned: number, links = 0): RollupNode =>
      leaf({
        trioLeaf: t(planned),
        trioEpicLinks: t(links),
        unitValueLeaf: t(planned),
        unitEpicLinks: t(links),
        childUnitFactor: 1,
      });
    const l1 = mkLeaf(100);
    const l2 = mkLeaf(200, 50);
    const root = branch([l1, l2], {
      trioEpicLinks: t(10),
      unitEpicLinks: t(10),
      childUnitFactor: 1,
    });
    expect(nodeUnitValue(root)).toEqual(nodeTrio(root));
  });
});

describe("epicTopGoalBenefits", () => {
  const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
    id: "k",
    baseline: 0,
    target: 10,
    current: 5,
    valuePerUnit: null,
    ...over,
  });

  it("Wagen example: one epic → two top goals ⇒ two benefit lines in correct units", () => {
    // Two top-level goals, each its own unit.
    const nodes = new Map<string, GoalNodeMeta>([
      [
        "annual",
        {
          id: "annual",
          parentId: null,
          name: "Annual Impact",
          unit: "€",
          parentUnitPerChildUnit: null,
        },
      ],
      [
        "onetime",
        {
          id: "onetime",
          parentId: null,
          name: "One-time Impact",
          unit: "€",
          parentUnitPerChildUnit: null,
        },
      ],
    ]);
    const links: EpicGoalLinkInput[] = [
      // implementierte Wagen → Annual Impact, recurring, 10000 €/Wagon
      {
        objectiveId: "annual",
        kpi: kpi({ id: "impl", target: 10, current: 5 }),
        conversionFactor: 10000,
        impactKind: "recurring",
        recurringInterval: "yearly",
      },
      // verkaufte Wagen → One-time Impact, one_time, 25000 €/Wagon
      {
        objectiveId: "onetime",
        kpi: kpi({ id: "sold", target: 4, current: 1 }),
        conversionFactor: 25000,
        impactKind: "one_time",
        recurringInterval: "yearly",
      },
    ];
    const rows = epicTopGoalBenefits(links, nodes);
    expect(rows).toHaveLength(2);
    const annual = rows.find((r) => r.topGoalId === "annual")!;
    expect(annual.unit).toBe("€");
    expect(annual.impactKind).toBe("recurring");
    expect(annual.planned).toBe(100000); // 10 × 10000
    expect(annual.realized).toBe(50000); // 5 × 10000
    const onetime = rows.find((r) => r.topGoalId === "onetime")!;
    expect(onetime.planned).toBe(100000); // 4 × 25000
    expect(onetime.realized).toBe(25000); // 1 × 25000
  });

  it("walks the parent chain, multiplying parentUnitPerChildUnit up to the top", () => {
    // top '€' ← mid 'Wagen' (10000 €/Wagon) ← link at mid.
    const nodes = new Map<string, GoalNodeMeta>([
      ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
      [
        "mid",
        { id: "mid", parentId: "top", name: "Mid", unit: "Wagen", parentUnitPerChildUnit: 10000 },
      ],
    ]);
    const links: EpicGoalLinkInput[] = [
      {
        objectiveId: "mid",
        kpi: kpi({ target: 10, current: 5 }), // KPI in "produzierte Teile", factor 2 Wagen/Teil
        conversionFactor: 2,
        impactKind: "one_time",
        recurringInterval: "yearly",
      },
    ];
    const rows = epicTopGoalBenefits(links, nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.topGoalId).toBe("top");
    expect(rows[0]!.unit).toBe("€");
    // planned: |10| × 2 (Wagen) × 10000 (€/Wagon) = 200000
    expect(rows[0]!.planned).toBe(200000);
    expect(rows[0]!.realized).toBe(100000); // 5 × 2 × 10000
  });

  it("a null factor in the chain breaks the benefit to 0", () => {
    const nodes = new Map<string, GoalNodeMeta>([
      ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
      [
        "mid",
        { id: "mid", parentId: "top", name: "Mid", unit: "Wagen", parentUnitPerChildUnit: null },
      ],
    ]);
    const rows = epicTopGoalBenefits(
      [
        {
          objectiveId: "mid",
          kpi: kpi(),
          conversionFactor: 2,
          impactKind: "one_time",
          recurringInterval: "yearly",
        },
      ],
      nodes,
    );
    expect(rows[0]!.planned).toBe(0);
  });

  it("groups two links into the same top goal + impactKind", () => {
    const nodes = new Map<string, GoalNodeMeta>([
      ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
    ]);
    const link = (id: string, factor: number): EpicGoalLinkInput => ({
      objectiveId: "top",
      kpi: kpi({ id, target: 1, current: 1 }),
      conversionFactor: factor,
      impactKind: "recurring",
      recurringInterval: "yearly",
    });
    const rows = epicTopGoalBenefits([link("a", 100), link("b", 200)], nodes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.planned).toBe(300);
  });
});

describe("epicGoalBenefitsPerNode", () => {
  const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
    id: "k",
    baseline: 0,
    target: 10,
    current: 5,
    valuePerUnit: null,
    ...over,
  });

  it("schreibt dem Kind unskaliert und der Wurzel skaliert gut (Wurzel == Top-Rollup)", () => {
    // top '€' ← mid 'Wagen' (10000 €/Wagon) ← Link an mid (Faktor 2 Wagen/Teil).
    const nodes = new Map<string, GoalNodeMeta>([
      ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
      [
        "mid",
        { id: "mid", parentId: "top", name: "Mid", unit: "Wagen", parentUnitPerChildUnit: 10000 },
      ],
    ]);
    const links: EpicGoalLinkInput[] = [
      {
        objectiveId: "mid",
        kpi: kpi({ target: 10, current: 5 }),
        conversionFactor: 2,
        impactKind: "one_time",
        recurringInterval: "yearly",
      },
    ];
    const rows = epicGoalBenefitsPerNode(links, nodes);
    const byId = new Map(rows.map((r) => [r.goalId, r]));
    // Kind (mid): unskaliert in Wagen — planned 10×2, realized 5×2.
    expect(byId.get("mid")).toMatchObject({ planned: 20, realized: 10 });
    // Wurzel (top): × 10000 €/Wagon — exakt der Top-Rollup-Wert.
    expect(byId.get("top")).toMatchObject({ planned: 200000, realized: 100000 });
    const top = epicTopGoalBenefits(links, nodes)[0]!;
    expect(byId.get("top")!.planned).toBe(top.planned);
    expect(byId.get("top")!.realized).toBe(top.realized);
  });

  it("summiert mehrere Links je Knoten und überlebt Zyklen", () => {
    // a ↔ b Zyklus: kein Endlos-Lauf, jeder erreichte Knoten genau einmal je Link.
    const nodes = new Map<string, GoalNodeMeta>([
      ["a", { id: "a", parentId: "b", name: "A", unit: "€", parentUnitPerChildUnit: 1 }],
      ["b", { id: "b", parentId: "a", name: "B", unit: "€", parentUnitPerChildUnit: 1 }],
    ]);
    const link: EpicGoalLinkInput = {
      objectiveId: "a",
      kpi: kpi({ target: 1, current: 1 }),
      conversionFactor: 100,
      impactKind: "recurring",
      recurringInterval: "yearly",
    };
    const rows = epicGoalBenefitsPerNode([link, link], nodes);
    const byId = new Map(rows.map((r) => [r.goalId, r]));
    expect(byId.get("a")!.planned).toBe(200); // 2 Links × 100, unskaliert
    expect(byId.get("b")).toBeDefined(); // über die Kante erreicht, kein Hänger
  });
});

describe("epicCascadeBreakdown", () => {
  const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
    id: "k",
    baseline: 0,
    target: 10,
    current: 5,
    valuePerUnit: null,
    ...over,
  });
  // top '€' ← mid 'Wagen' (10000 €/Wagon); Link am mid (KPI→Wagen, factor 2).
  const nodes = new Map<string, GoalNodeMeta>([
    ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
    [
      "mid",
      { id: "mid", parentId: "top", name: "Mid", unit: "Wagen", parentUnitPerChildUnit: 10000 },
    ],
  ]);
  const link = (over: Partial<EpicGoalLinkInput> = {}): EpicGoalLinkInput => ({
    objectiveId: "mid",
    kpi: kpi(),
    conversionFactor: 2,
    impactKind: "one_time",
    recurringInterval: "yearly",
    ...over,
  });

  it("gibt jede Stufe aus: verknüpftes Ziel → Top-Ziel, je in dessen Einheit", () => {
    const [c] = epicCascadeBreakdown([link()], nodes);
    expect(c!.impactKind).toBe("one_time");
    expect(c!.steps.map((s) => [s.goalId, s.unit, s.planned, s.realized])).toEqual([
      ["mid", "Wagen", 20, 10], // 10×2, 5×2
      ["top", "€", 200000, 100000], // ×10000
    ]);
    expect(c!.steps.every((s) => !s.brokenHere)).toBe(true);
    // letzte Stufe == epicTopGoalBenefits-Top-Wert
    expect(c!.steps.at(-1)!.planned).toBe(epicTopGoalBenefits([link()], nodes)[0]!.planned);
  });

  it("markiert die Ebene mit fehlendem Faktor (brokenHere) und nullt ab dort", () => {
    const broken = new Map<string, GoalNodeMeta>([
      ["top", { id: "top", parentId: null, name: "Top", unit: "€", parentUnitPerChildUnit: null }],
      [
        "mid",
        { id: "mid", parentId: "top", name: "Mid", unit: "Wagen", parentUnitPerChildUnit: null },
      ],
    ]);
    const [c] = epicCascadeBreakdown([link()], broken);
    expect(c!.steps[0]).toMatchObject({ goalId: "mid", planned: 20, brokenHere: false });
    expect(c!.steps[1]).toMatchObject({ goalId: "top", planned: 0, brokenHere: true });
  });

  it("recurring+monthly annualisiert am Blatt (×12)", () => {
    const [c] = epicCascadeBreakdown(
      [link({ impactKind: "recurring", recurringInterval: "monthly" })],
      nodes,
    );
    expect(c!.steps[0]!.planned).toBe(240); // 10×2×12
    expect(c!.steps[1]!.planned).toBe(2_400_000); // ×10000
  });

  it("Links ohne conversionFactor werden übersprungen", () => {
    expect(epicCascadeBreakdown([link({ conversionFactor: null })], nodes)).toEqual([]);
  });
});

describe("kpiTrio — Übererfüllung auf dem €-Pfad", () => {
  const kpi = { id: "k", baseline: 0, target: 100, current: 130, valuePerUnit: 1_000 };

  it("130 % Zielerreichung ergeben 130 % des Plan-€", () => {
    // Früher auf 100 % gedeckelt — der €-Rollup konnte den Plan nie
    // übertreffen, während die Einheiten-Kaskade (`epicSuccessKpiContribution`)
    // längst ungedeckelt rechnete. Dasselbe Epic erschien in zwei Sichten
    // verschieden.
    const t = kpiTrio(kpi);
    expect(t.planned).toBe(100_000);
    expect(t.realized).toBe(130_000);
  });

  it("eine Verschlechterung ergibt 0, nicht negativ", () => {
    expect(kpiTrio({ ...kpi, current: -50 }).realized).toBe(0);
  });

  it("die Prozent-Anzeige bleibt gedeckelt — dort ist 0..1 die Definition", () => {
    expect(kpiAchievement(kpi)).toBe(1);
  });
});
