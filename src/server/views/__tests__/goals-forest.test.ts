import { describe, it, expect } from "vitest";
import {
  resolveNode,
  buildStrategyTree,
  buildProgressChart,
  type ForestObjective,
  type ForestLookups,
} from "@/server/views/goals-forest";

const emptyLookups = (): ForestLookups => ({
  latestCheckin: new Map(),
  relatedEpics: new Map(),
  autoKpiLinks: new Map(),
  relatedWork: new Map(),
  valueStreams: new Map(),
  arts: new Map(),
  customFieldDefs: [],
  customFieldValues: new Map(),
});

const obj = (over: Partial<ForestObjective>): ForestObjective => ({
  id: "x",
  parentObjectiveId: null,
  nodeKind: "objective",
  title: "X",
  narrative: null,
  period: null,
  status: null,
  dueDate: null,
  ownerId: null,
  accountableTeam: null,
  metricUnit: null,
  metricType: "number",
  precision: 0,
  currencyCode: null,
  rollupWeight: null,
  parentUnitPerChildUnit: null,
  includeInParentRollup: true,
  baseline: null,
  target: null,
  current: null,
  progressMode: null,
  ...over,
});

describe("resolveNode — der Mode/Leaf-Seam", () => {
  const ctx = { hasChildren: false, autoKpiLinks: [], relatedEpics: [] };

  it("löst progressMode ab: null+Kinder ⇒ rollup, null+Blatt ⇒ manual", () => {
    expect(resolveNode(obj({}), { ...ctx, hasChildren: true }).mode).toBe("rollup");
    expect(resolveNode(obj({}), { ...ctx, hasChildren: false }).mode).toBe("manual");
  });

  it("rollup ⇒ progressLeaf null; manual ⇒ keyResultProgress", () => {
    expect(resolveNode(obj({ baseline: 0, target: 10, current: 5 }), ctx).progressLeaf).toBeCloseTo(
      0.5,
    );
    expect(resolveNode(obj({ target: 10 }), { ...ctx, hasChildren: true }).progressLeaf).toBeNull();
  });

  it("auto_kpi ⇒ Ist delta-basiert auf Ziel-Skala (TAT: 122−25=97 ⇒ ~40 %)", () => {
    const tat = obj({
      progressMode: "auto_kpi",
      metricUnit: "Days",
      baseline: 122,
      target: 60,
    });
    // Faktor-Link: KPI-Δ 50 × Faktor 0,5 = 25 Days ⇒ Ist 97 ⇒ (122−97)/(122−60)=0,40
    const factored = resolveNode(tat, {
      ...ctx,
      autoKpiLinks: [
        { kind: "factor", kpi: { baseline: 0, target: 100, current: 50 }, factor: 0.5 },
      ],
    });
    expect(factored.effectiveCurrent).toBe(97);
    expect(factored.progressLeaf).toBeCloseTo(0.403, 2);
    // Unit-Kaskade ohne Doppelzählung: realized 25 Days, planned 62.
    expect(factored.unitValueLeaf).toEqual({ planned: 62, realized: 25, runRate: 25 });
    expect(factored.unitEpicLinks).toEqual({ planned: 0, realized: 0, runRate: 0 });

    // sameUnit-Fallback: einheiten-gleiche KPI ("Days") als Delta auf die Baseline.
    const grow = obj({ progressMode: "auto_kpi", metricUnit: "Days", baseline: 0, target: 500 });
    expect(
      resolveNode(grow, {
        ...ctx,
        autoKpiLinks: [
          {
            kind: "sameUnit",
            kpis: [{ unit: "Days", point: { baseline: 0, target: 500, current: 250 } }],
          },
        ],
      }).progressLeaf,
    ).toBeCloseTo(0.5);
  });

  it("trioLeaf ist immer Null-Trio (Ziel-Eigen-Metrik trägt €0 bei)", () => {
    const auto = resolveNode(obj({ progressMode: "auto_kpi", baseline: 0, target: 100 }), ctx);
    expect(auto.trioLeaf).toEqual({ planned: 0, realized: 0, runRate: 0 });
    const manual = resolveNode(obj({ progressMode: "manual", baseline: 0, target: 100 }), ctx);
    expect(manual.trioLeaf).toEqual({ planned: 0, realized: 0, runRate: 0 });
  });

  it("trioEpicLinks: rechnet den €-Trio je verknüpftem Epic", () => {
    const r = resolveNode(obj({}), {
      ...ctx,
      relatedEpics: [
        {
          epicId: "e",
          title: "E",
          stageGate: "L2",
          href: "/x",
          kpis: [{ id: "k", baseline: 0, target: 10, current: 10, valuePerUnit: 5 }],
        },
      ],
    });
    expect(r.relatedEpics[0]!.trio.planned).toBe(50);
    expect(r.trioEpicLinks).toEqual({ planned: 50, realized: 50, runRate: 50 });
  });
});

describe("buildStrategyTree — Baum-Assemblierung + Rollup", () => {
  it("gewichteter Rollup, contributionShare, Tiefe", () => {
    const rows: ForestObjective[] = [
      obj({ id: "T", title: "Theme", progressMode: "rollup" }),
      obj({
        id: "A",
        parentObjectiveId: "T",
        baseline: 0,
        target: 10,
        current: 5,
        rollupWeight: 1,
      }),
      obj({
        id: "B",
        parentObjectiveId: "T",
        baseline: 0,
        target: 10,
        current: 10,
        rollupWeight: 3,
      }),
    ];
    const { themes } = buildStrategyTree({ rows, lookups: emptyLookups() });
    const T = themes[0]!;
    // (0.5·1 + 1.0·3) / 4 = 0.875
    expect(T.progress).toBeCloseTo(0.875);
    expect(T.depth).toBe(0);
    expect(T.children.map((c) => c.contributionShare)).toEqual([0.25, 0.75]);
    expect(T.children[0]!.progress).toBeCloseTo(0.5);
    expect(T.children[1]!.depth).toBe(1);
  });

  it("includeInParentRollup=false: Kind fällt aus Ø und Σ des Elternteils", () => {
    const rows: ForestObjective[] = [
      obj({ id: "T", title: "Theme", progressMode: "rollup" }),
      obj({
        id: "A",
        parentObjectiveId: "T",
        baseline: 0,
        target: 10,
        current: 0,
        rollupWeight: 1,
      }),
      obj({
        id: "B",
        parentObjectiveId: "T",
        baseline: 0,
        target: 10,
        current: 10,
        rollupWeight: 1,
        includeInParentRollup: false,
      }),
    ];
    const { themes } = buildStrategyTree({ rows, lookups: emptyLookups() });
    const T = themes[0]!;
    // Nur A zählt (0.0); B (1.0) ist ausgenommen ⇒ Ø = 0, nicht 0.5.
    expect(T.progress).toBeCloseTo(0);
    // Ausgenommenes Kind bleibt sichtbar im Baum.
    expect(T.children.map((c) => c.id)).toEqual(["A", "B"]);
    expect(T.children[1]!.includeInParentRollup).toBe(false);
  });

  it("Trio summiert von unten nach oben (aus verknüpften Epics); tenantTrio über die Roots", () => {
    const rows: ForestObjective[] = [
      obj({ id: "T", progressMode: "rollup" }),
      obj({ id: "KR", parentObjectiveId: "T", baseline: 0, target: 100 }),
    ];
    // €-Wert stammt aus einem am KR verknüpften Epic (trioEpicLinks), nicht aus
    // der Eigen-Metrik: span 100 × 10 = 1000 planned, achievement 0.5 → 500.
    const lookups: ForestLookups = {
      ...emptyLookups(),
      relatedEpics: new Map([
        [
          "KR",
          [
            {
              epicId: "e",
              title: "E",
              stageGate: "L2",
              href: "/x",
              kpis: [{ id: "k", baseline: 0, target: 100, current: 50, valuePerUnit: 10 }],
            },
          ],
        ],
      ]),
    };
    const { themes, tenantTrio } = buildStrategyTree({ rows, lookups });
    expect(themes[0]!.trio).toEqual({ planned: 1000, realized: 500, runRate: 500 });
    expect(tenantTrio).toEqual({ planned: 1000, realized: 500, runRate: 500 });
  });

  it("unitValue: Kind in 'Wagen' rollt via parentUnitPerChildUnit in '€'-Theme", () => {
    const rows: ForestObjective[] = [
      obj({ id: "T", title: "Annual Impact", progressMode: "rollup", metricUnit: "€" }),
      obj({
        id: "W",
        parentObjectiveId: "T",
        metricUnit: "Wagen",
        baseline: 0,
        target: 10,
        current: 4,
        parentUnitPerChildUnit: 10000, // 10000 €/Wagon
      }),
    ];
    const { themes } = buildStrategyTree({ rows, lookups: emptyLookups() });
    const T = themes[0]!;
    // Kind-Eigenwert: planned |10−0|=10, realized 4 → × 10000 im Eltern.
    expect(T.unitValue.planned).toBe(100000);
    expect(T.unitValue.realized).toBe(40000);
    // Das Kind selbst trägt seinen Wert in EIGENER Einheit (Wagen).
    expect(themes[0]!.children[0]!.unitValue).toEqual({ planned: 10, realized: 4, runRate: 4 });
  });

  const tatTree = (parentMode: "kpi_tree" | "rollup"): ForestObjective[] => [
    obj({
      id: "P",
      title: "TAT Optimierun",
      progressMode: parentMode,
      metricType: "currency",
      metricUnit: "€",
      currencyCode: "€",
      baseline: 0,
      target: 10_000_000,
    }),
    obj({
      id: "C",
      parentObjectiveId: "P",
      progressMode: "kpi_tree",
      metricUnit: "Days",
      baseline: 122,
      target: 60,
      parentUnitPerChildUnit: 16000, // 1 Day = 16.000 €
    }),
  ];
  const tatLookups = (): ForestLookups => ({
    ...emptyLookups(),
    autoKpiLinks: new Map([
      ["C", [{ kind: "factor", kpi: { baseline: 0, target: 100, current: 50 }, factor: 0.5 }]],
    ]),
  });

  it("kpi_tree: €-Parent misst wert-basiert am kaskadierten Wert (TAT: Kind 40 %, Parent 4 %)", () => {
    const { themes } = buildStrategyTree({ rows: tatTree("kpi_tree"), lookups: tatLookups() });
    const P = themes[0]!;
    const C = P.children[0]!;
    // Kind (kpi_tree-Blatt): Ist 97 Days ⇒ 40 %; Wert 25 Days (ohne Doppelzählung).
    expect(C.progress).toBeCloseTo(0.403, 2);
    expect(C.unitValue).toEqual({ planned: 62, realized: 25, runRate: 25 });
    // Parent (kpi_tree-Ast): 25 Days × 16000 = 400.000 € realized; Completion 400k/10M = 4 %.
    expect(P.unitValue.realized).toBe(400_000);
    expect(P.progress).toBeCloseTo(0.04, 4);
  });

  it("rollup-Parent bleibt der Kinder-Durchschnitt (kein Wert-Override) — hier = Kind 40 %", () => {
    const { themes } = buildStrategyTree({ rows: tatTree("rollup"), lookups: tatLookups() });
    const P = themes[0]!;
    // rollup misst den Ø der Kind-Fortschritte (ein Kind mit 40 %), nicht 4 %.
    expect(P.progress).toBeCloseTo(0.403, 2);
  });
});

describe("buildProgressChart", () => {
  it("value-Mode: Status-Punkt + manuelles Live-Ende", () => {
    const chart = buildProgressChart({
      rootId: "R",
      rows: [
        {
          id: "R",
          parentObjectiveId: null,
          progressMode: "manual",
          baseline: 0,
          target: 10,
          current: 8,
          rollupWeight: null,
          metricUnit: null,
          metricType: "number",
          currencyCode: null,
        },
      ],
      progressByNode: new Map(),
      autoKpiSeriesByNode: new Map(),
      rootCheckins: [
        { atMs: Date.parse("2026-01-01"), status: "on_track", value: 5, progress: 0.5 },
      ],
      now: "2026-06-01T00:00:00.000Z",
    });
    expect(chart.mode).toBe("value");
    const points = chart.series;
    expect(points.find((p) => p.value === 5)?.status).toBe("on_track"); // Status-Punkt
    expect(points.some((p) => p.value === 8 && p.status === null)).toBe(true); // Live-Ende
    expect(chart.yDomain[0]).toBeLessThanOrEqual(0);
    expect(chart.yDomain[1]).toBeGreaterThanOrEqual(10);
  });

  it("unbekannte Wurzel ⇒ leerer Chart", () => {
    expect(
      buildProgressChart({
        rootId: "nope",
        rows: [],
        progressByNode: new Map(),
        autoKpiSeriesByNode: new Map(),
        rootCheckins: [],
        now: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({ mode: "percent", series: [], yDomain: [0, 100] });
  });
});
