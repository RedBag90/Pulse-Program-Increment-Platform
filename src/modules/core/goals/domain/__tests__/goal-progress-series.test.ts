import { describe, it, expect } from "vitest";
import {
  buildAutoKpiSeries,
  buildNodeProgressSeries,
} from "@/modules/core/goals/domain/goal-progress-series";
import type { SeriesNode } from "@/modules/core/goals/domain/goal-progress-series";
import {
  nodeProgress,
  type RollupNode,
  type RollupTrio,
} from "@/modules/core/goals/domain/goals-rollup";
import { goalStatusColor } from "@/modules/core/goals/domain/goal-status";
import { parseMeasurements, latestMeasurement } from "@/modules/core/kpi/domain/kpi-measurement";

const unit = { metricUnit: "Kunden", metricType: "number", currencyCode: null };
const ZERO: RollupTrio = { planned: 0, realized: 0, runRate: 0 };

/** Minimaler RollupNode-Blatt für den Invarianten-Abgleich Serie ↔ Kennzahl. */
function rollupLeaf(over: Partial<RollupNode>): RollupNode {
  return {
    weight: 1,
    includeInRollup: true,
    mode: "manual",
    progressLeaf: null,
    trioLeaf: ZERO,
    trioEpicLinks: ZERO,
    children: [],
    ...over,
  };
}

describe("goalStatusColor", () => {
  it("maps status to tier hex", () => {
    expect(goalStatusColor("on_track")).toBe("#10b981");
    expect(goalStatusColor("achieved")).toBe("#10b981");
    expect(goalStatusColor("at_risk")).toBe("#f59e0b");
    expect(goalStatusColor("off_track")).toBe("#f43f5e");
    expect(goalStatusColor("dropped")).toBe("#94a3b8");
    expect(goalStatusColor(null)).toBe("#94a3b8");
  });
});

describe("parseMeasurements / latestMeasurement", () => {
  it("parses + sorts chronologically, ignores malformed", () => {
    const raw = [
      { date: "2026-03-01", value: 5 },
      { date: "2026-01-01", value: 2 },
      { date: "bad" },
      { value: 9 },
    ];
    expect(parseMeasurements(raw)).toEqual([
      { at: "2026-01-01", value: 2 },
      { at: "2026-03-01", value: 5 },
    ]);
    expect(latestMeasurement(raw)).toBe(5);
    expect(latestMeasurement(null)).toBeNull();
    expect(latestMeasurement([])).toBeNull();
  });
});

describe("buildAutoKpiSeries (delta-basiert, absolut auf Ziel-Skala)", () => {
  const grow = { ...unit, baseline: 0, target: 100 }; // Steigerung, dir +1
  const tat = {
    metricUnit: "Days",
    metricType: "number",
    currencyCode: null,
    baseline: 122,
    target: 60,
  }; // Reduktion

  it("sameUnit: laufende Δ-Summe über die Termin-Union (baseline 0 ⇒ = Rohwerte)", () => {
    const links = [
      {
        kind: "sameUnit" as const,
        kpis: [
          {
            unit: "Kunden",
            baseline: 0,
            target: 100,
            measurements: [
              { at: "2026-01-01", value: 10 },
              { at: "2026-03-01", value: 30 },
            ],
          },
          {
            unit: "Kunden",
            baseline: 0,
            target: 100,
            measurements: [{ at: "2026-02-01", value: 5 }],
          },
          {
            unit: "Leads",
            baseline: 0,
            target: 100,
            measurements: [{ at: "2026-02-15", value: 999 }],
          }, // ignoriert
        ],
      },
    ];
    expect(buildAutoKpiSeries(grow, links)).toEqual([
      { at: "2026-01-01", value: 10 }, // nur KPI A
      { at: "2026-02-01", value: 15 }, // A(10) + B(5)
      { at: "2026-03-01", value: 35 }, // A(30) + B(5)
    ]);
  });
  it("factor auf Reduktionsziel: KPI-Δ × Faktor senkt den Ist (TAT: 122 − …)", () => {
    expect(
      buildAutoKpiSeries(tat, [
        {
          kind: "factor",
          kpiBaseline: 0,
          kpiTarget: 100,
          factor: 0.5,
          measurements: [
            { at: "2026-01-01", value: 20 }, // Δ 20×0,5=10 ⇒ 122−10=112
            { at: "2026-02-01", value: 50 }, // Δ 50×0,5=25 ⇒ 122−25=97
          ],
        },
      ]),
    ).toEqual([
      { at: "2026-01-01", value: 112 },
      { at: "2026-02-01", value: 97 },
    ]);
  });
  it("empty when no unit matches / baseline fehlt", () => {
    expect(
      buildAutoKpiSeries(grow, [
        {
          kind: "sameUnit",
          kpis: [
            { unit: "Leads", baseline: 0, target: 100, measurements: [{ at: "x", value: 1 }] },
          ],
        },
      ]),
    ).toEqual([]);
  });
});

function leaf(over: Partial<SeriesNode>): SeriesNode {
  return {
    progressMode: "manual",
    baseline: 0,
    target: 100,
    current: null,
    rollupWeight: 1,
    includeInParentRollup: true,
    unitSpec: unit,
    checkins: [],
    autoKpiLinks: [],
    children: [],
    ...over,
  };
}

describe("buildNodeProgressSeries", () => {
  it("auto_kpi: KPI sum normalized to progress", () => {
    const node = leaf({
      progressMode: "auto_kpi",
      target: 100,
      autoKpiLinks: [
        {
          kind: "sameUnit",
          kpis: [
            {
              unit: "Kunden",
              baseline: 0,
              target: 100,
              measurements: [
                { at: "2026-01-01", value: 20 },
                { at: "2026-02-01", value: 60 },
              ],
            },
          ],
        },
      ],
    });
    expect(buildNodeProgressSeries(node, "2026-03-01")).toEqual([
      { at: "2026-01-01", progress: 0.2 },
      { at: "2026-02-01", progress: 0.6 },
    ]);
  });

  it("kpi_tree-Blatt: gleiche KPI-Serie wie auto_kpi", () => {
    const node = leaf({
      progressMode: "kpi_tree",
      target: 100,
      autoKpiLinks: [
        {
          kind: "sameUnit",
          kpis: [
            {
              unit: "Kunden",
              baseline: 0,
              target: 100,
              measurements: [
                { at: "2026-01-01", value: 20 },
                { at: "2026-02-01", value: 60 },
              ],
            },
          ],
        },
      ],
    });
    expect(buildNodeProgressSeries(node, "2026-03-01")).toEqual([
      { at: "2026-01-01", progress: 0.2 },
      { at: "2026-02-01", progress: 0.6 },
    ]);
  });

  it("kpi_tree-Ast: gewichteter Kinder-Ø über die Zeit (wie rollup)", () => {
    const a = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-01-01", progress: 0.2 }],
      current: null,
    });
    const b = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-01-01", progress: 0.8 }],
      current: null,
    });
    const ast = leaf({ progressMode: "kpi_tree", target: null, children: [a, b], current: null });
    expect(buildNodeProgressSeries(ast, "2026-02-01")).toEqual([
      { at: "2026-01-01", progress: 0.5 },
    ]);
  });

  it("manual: own check-ins + live end", () => {
    const node = leaf({
      progressMode: "manual",
      current: 40,
      checkins: [{ at: "2026-01-10", progress: 0.1 }],
    });
    expect(buildNodeProgressSeries(node, "2026-02-01")).toEqual([
      { at: "2026-01-10", progress: 0.1 },
      { at: "2026-02-01", progress: 0.4 },
    ]);
  });

  it("manual: liveEnd=false unterdrueckt das heute-Ende (geschlossenes Ziel)", () => {
    const node = leaf({
      progressMode: "manual",
      current: 40,
      checkins: [{ at: "2026-01-10", progress: 0.1 }],
    });
    expect(buildNodeProgressSeries(node, "2026-02-01", false)).toEqual([
      { at: "2026-01-10", progress: 0.1 },
    ]);
  });

  it("rollup: weighted average of children over the date union (step)", () => {
    const a = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [
        { at: "2026-01-01", progress: 0 },
        { at: "2026-03-01", progress: 1 },
      ],
      current: null,
    });
    const b = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-02-01", progress: 0.5 }],
      current: null,
    });
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    // dates: 01-01 (a=0, b none → 0), 02-01 (a=0, b=0.5 → 0.25), 03-01 (a=1, b=0.5 → 0.75)
    expect(buildNodeProgressSeries(parent, "2026-04-01")).toEqual([
      { at: "2026-01-01", progress: 0 },
      { at: "2026-02-01", progress: 0.25 },
      { at: "2026-03-01", progress: 0.75 },
    ]);
  });

  it("rollup: honours weights", () => {
    const a = leaf({
      progressMode: "manual",
      rollupWeight: 3,
      checkins: [{ at: "2026-01-01", progress: 0 }],
      current: null,
    });
    const b = leaf({
      progressMode: "manual",
      rollupWeight: 1,
      checkins: [{ at: "2026-01-01", progress: 1 }],
      current: null,
    });
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    expect(buildNodeProgressSeries(parent, "2026-02-01")).toEqual([
      { at: "2026-01-01", progress: 0.25 },
    ]);
  });

  it("rollup: stabiler Nenner — ein spät gestartetes Kind erzeugt KEINE Delle", () => {
    // a=0.3, b=0.6 durchgehend; c startet erst am 15.7. bei 0, steigt dann auf 0.3.
    const a = leaf({ checkins: [{ at: "2026-01-01", progress: 0.3 }], current: null });
    const b = leaf({ checkins: [{ at: "2026-01-01", progress: 0.6 }], current: null });
    const c = leaf({
      checkins: [
        { at: "2026-07-15", progress: 0 },
        { at: "2026-08-01", progress: 0.3 },
      ],
      current: null,
    });
    const parent = leaf({
      progressMode: "rollup",
      target: null,
      children: [a, b, c],
      current: null,
    });
    const s = buildNodeProgressSeries(parent, "2026-09-01");
    // c zählt von Anfang an (bei 0), nicht erst ab 15.7. → Frühwert 0.3 (nicht 0.45),
    // und die Reihe ist MONOTON steigend (keine 0.45→0.3-Delle).
    expect(s.map((p) => p.at)).toEqual(["2026-01-01", "2026-07-15", "2026-08-01"]);
    const vals = s.map((p) => p.progress);
    [0.3, 0.3, 0.4].forEach((exp, i) => expect(vals[i]!).toBeCloseTo(exp, 10));
    expect(vals).toEqual([...vals].sort((x, y) => x - y)); // monoton nicht-fallend
  });

  it("rollup: includeInParentRollup=false zählt weder in Linie noch Endpunkt", () => {
    const a = leaf({ checkins: [{ at: "2026-01-01", progress: 0.3 }], current: null });
    const b = leaf({
      includeInParentRollup: false,
      checkins: [{ at: "2026-01-01", progress: 0.9 }],
      current: null,
    });
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    expect(buildNodeProgressSeries(parent, "2026-02-01")).toEqual([
      { at: "2026-01-01", progress: 0.3 }, // nur a; b ausgeschlossen (nicht 0.6)
    ]);
  });

  it("rollup: leeres Kind (nie Fortschritt) wird ausgeklammert wie nodeProgress-null", () => {
    const a = leaf({ checkins: [{ at: "2026-01-01", progress: 0.4 }], current: null });
    const empty = leaf({ checkins: [], current: null }); // keine Punkte, kein Live-Ende
    const parent = leaf({
      progressMode: "rollup",
      target: null,
      children: [a, empty],
      current: null,
    });
    expect(buildNodeProgressSeries(parent, "2026-02-01")).toEqual([
      { at: "2026-01-01", progress: 0.4 }, // nur a; leeres Kind zählt nicht (kein 0.2)
    ]);
  });

  it("rollup: Serien-Endpunkt = nodeProgress (dieselbe Rollup-Regel)", () => {
    const a = leaf({ progressMode: "manual", current: 30, rollupWeight: 2 }); // 0.3 @ target 100
    const b = leaf({ progressMode: "manual", current: 90, rollupWeight: 1 }); // 0.9
    const parent = leaf({ progressMode: "rollup", target: null, children: [a, b], current: null });
    const s = buildNodeProgressSeries(parent, "2026-02-01");
    const end = s.at(-1)!.progress;
    // Kennzahl: gewichteter Ø der Kind-Ist-Fortschritte = (2·0.3 + 1·0.9)/3 = 0.5.
    const expected = nodeProgress({
      weight: 1,
      includeInRollup: true,
      mode: "rollup",
      progressLeaf: null,
      trioLeaf: ZERO,
      trioEpicLinks: ZERO,
      children: [
        rollupLeaf({ weight: 2, progressLeaf: 0.3 }),
        rollupLeaf({ weight: 1, progressLeaf: 0.9 }),
      ],
    });
    expect(end).toBeCloseTo(expected!, 10);
    expect(end).toBeCloseTo(0.5, 10);
  });
});
