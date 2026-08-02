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
  epicKpiUnits: new Map(),
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
  formula: "manual",
  progressMode: null,
  ...over,
});

describe("resolveNode — der Mode/Leaf-Seam", () => {
  const ctx = { hasChildren: false, epicKpiUnits: [], relatedEpics: [] };

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

  it("trioLeaf ist immer Null-Trio (Ziel-Eigen-Metrik trägt €0 bei)", () => {
    const auto = resolveNode(obj({ formula: "auto_from_kpi", baseline: 0, target: 100 }), ctx);
    expect(auto.trioLeaf).toEqual({ planned: 0, realized: 0, runRate: 0 });
    const manual = resolveNode(obj({ formula: "manual", baseline: 0, target: 100 }), ctx);
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
      epicKpisByNode: new Map(),
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
        epicKpisByNode: new Map(),
        rootCheckins: [],
        now: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({ mode: "percent", series: [], yDomain: [0, 100] });
  });
});
