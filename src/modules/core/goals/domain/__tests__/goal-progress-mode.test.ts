import { describe, it, expect } from "vitest";
import {
  PROGRESS_MODES,
  isProgressMode,
  effectiveProgressMode,
  unitsMatch,
  autoKpiCurrent,
  isMeasurableGoal,
  derivesCurrentFromKpis,
  aggregatesFromChildren,
  usesValueBasedCompletion,
} from "@/modules/core/goals/domain/goal-progress-mode";

describe("progress mode basics", () => {
  it("exposes the four modes", () => {
    expect(PROGRESS_MODES).toEqual(["manual", "rollup", "auto_kpi", "kpi_tree"]);
  });
  it("isProgressMode guards", () => {
    expect(isProgressMode("manual")).toBe(true);
    expect(isProgressMode("auto_kpi")).toBe(true);
    expect(isProgressMode("kpi_tree")).toBe(true);
    expect(isProgressMode("")).toBe(false);
    expect(isProgressMode(null)).toBe(false);
    expect(isProgressMode("nonsense")).toBe(false);
  });
});

describe("Blatt-vs-Ast-Prädikate", () => {
  it("derivesCurrentFromKpis: auto_kpi immer, kpi_tree nur als Blatt", () => {
    expect(derivesCurrentFromKpis("auto_kpi", false)).toBe(true);
    expect(derivesCurrentFromKpis("auto_kpi", true)).toBe(true);
    expect(derivesCurrentFromKpis("kpi_tree", false)).toBe(true);
    expect(derivesCurrentFromKpis("kpi_tree", true)).toBe(false);
    expect(derivesCurrentFromKpis("rollup", false)).toBe(false);
    expect(derivesCurrentFromKpis("manual", false)).toBe(false);
  });
  it("aggregatesFromChildren: rollup/kpi_tree nur mit Kindern", () => {
    expect(aggregatesFromChildren("rollup", true)).toBe(true);
    expect(aggregatesFromChildren("kpi_tree", true)).toBe(true);
    expect(aggregatesFromChildren("rollup", false)).toBe(false);
    expect(aggregatesFromChildren("kpi_tree", false)).toBe(false);
    expect(aggregatesFromChildren("auto_kpi", true)).toBe(false);
    expect(aggregatesFromChildren("manual", true)).toBe(false);
  });
  it("usesValueBasedCompletion: nur kpi_tree-Ast", () => {
    expect(usesValueBasedCompletion("kpi_tree", true)).toBe(true);
    expect(usesValueBasedCompletion("kpi_tree", false)).toBe(false);
    expect(usesValueBasedCompletion("rollup", true)).toBe(false);
  });
});

describe("effectiveProgressMode", () => {
  it("uses a stored valid mode", () => {
    expect(effectiveProgressMode("auto_kpi", true)).toBe("auto_kpi");
    expect(effectiveProgressMode("manual", true)).toBe("manual");
  });
  it("derives from structure when null/invalid (legacy behaviour)", () => {
    expect(effectiveProgressMode(null, true)).toBe("rollup");
    expect(effectiveProgressMode(null, false)).toBe("manual");
    expect(effectiveProgressMode("bogus", true)).toBe("rollup");
  });
});

describe("unitsMatch", () => {
  it("matches free-label units case/space-insensitively", () => {
    const goal = { metricUnit: " Kunden ", metricType: "number", currencyCode: null };
    expect(unitsMatch(goal, "kunden")).toBe(true);
    expect(unitsMatch(goal, "Leads")).toBe(false);
  });
  it("matches currency by code, not label", () => {
    const goal = { metricUnit: "€", metricType: "currency", currencyCode: "EUR" };
    expect(unitsMatch(goal, "EUR")).toBe(true);
    expect(unitsMatch(goal, "USD")).toBe(false);
  });
  it("empty units never match", () => {
    expect(unitsMatch({ metricUnit: "", metricType: "number", currencyCode: null }, "")).toBe(
      false,
    );
    expect(unitsMatch({ metricUnit: null, metricType: "number", currencyCode: null }, null)).toBe(
      false,
    );
  });
});

describe("autoKpiCurrent (delta-basiert, absolut auf Ziel-Skala)", () => {
  // Reduktionsziel wie „TAT": Einheit Days, 122 → 60.
  const tat = {
    metricUnit: "Days",
    metricType: "number",
    currencyCode: null,
    baseline: 122,
    target: 60,
  };
  // Steigerungsziel: Kunden, 0 → 100.
  const grow = {
    metricUnit: "Kunden",
    metricType: "number",
    currencyCode: null,
    baseline: 0,
    target: 100,
  };

  it("factor link: KPI-Δ × Faktor senkt den Ist Richtung Target (TAT: 122 − 25 = 97)", () => {
    expect(
      autoKpiCurrent(tat, [
        { kind: "factor", kpi: { baseline: 0, target: 100, current: 50 }, factor: 0.5 },
      ]),
    ).toBe(97);
  });
  it("factor link: unvollständige KPI trägt nichts bei ⇒ null", () => {
    expect(
      autoKpiCurrent(tat, [
        { kind: "factor", kpi: { baseline: 0, target: 100, current: null }, factor: 0.5 },
      ]),
    ).toBeNull();
  });

  it("sameUnit link: einheiten-gleiches KPI-Δ auf die Baseline (grow: 0 + 30 = 30)", () => {
    expect(
      autoKpiCurrent(grow, [
        {
          kind: "sameUnit",
          kpis: [
            { unit: "Kunden", point: { baseline: 0, target: 100, current: 20 } },
            { unit: "Kunden", point: { baseline: 0, target: 100, current: 10 } },
          ],
        },
      ]),
    ).toBe(30);
  });
  it("sameUnit link: ignoriert Fremd-Einheiten und unvollständige KPIs", () => {
    expect(
      autoKpiCurrent(grow, [
        {
          kind: "sameUnit",
          kpis: [
            { unit: "Kunden", point: { baseline: 0, target: 100, current: 30 } },
            { unit: "Leads", point: { baseline: 0, target: 100, current: 999 } },
            { unit: "Kunden", point: { baseline: 0, target: 100, current: null } },
          ],
        },
      ]),
    ).toBe(30);
  });

  it("mischt factor- und sameUnit-Beiträge (grow: 0 + 5×2 + 30 = 40)", () => {
    expect(
      autoKpiCurrent(grow, [
        { kind: "factor", kpi: { baseline: 0, target: 50, current: 5 }, factor: 2 },
        {
          kind: "sameUnit",
          kpis: [{ unit: "Kunden", point: { baseline: 0, target: 100, current: 30 } }],
        },
      ]),
    ).toBe(40);
  });

  it("null wenn baseline/target fehlen oder nichts beiträgt", () => {
    expect(
      autoKpiCurrent(
        {
          metricUnit: "Days",
          metricType: "number",
          currencyCode: null,
          baseline: null,
          target: 60,
        },
        [{ kind: "factor", kpi: { baseline: 0, target: 100, current: 50 }, factor: 0.5 }],
      ),
    ).toBeNull();
    expect(
      autoKpiCurrent(grow, [
        {
          kind: "sameUnit",
          kpis: [{ unit: "Leads", point: { baseline: 0, target: 100, current: 5 } }],
        },
      ]),
    ).toBeNull();
    expect(autoKpiCurrent(grow, [])).toBeNull();
  });
});

describe("isMeasurableGoal", () => {
  it("rollup needs children", () => {
    expect(isMeasurableGoal({ progressMode: "rollup", target: null, hasChildren: true })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "rollup", target: 100, hasChildren: false })).toBe(
      false,
    );
  });
  it("manual/auto_kpi need a target", () => {
    expect(isMeasurableGoal({ progressMode: "manual", target: 100, hasChildren: false })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "manual", target: null, hasChildren: true })).toBe(
      false,
    );
    expect(isMeasurableGoal({ progressMode: "auto_kpi", target: 50, hasChildren: false })).toBe(
      true,
    );
  });
  it("kpi_tree ist messbar als Ast (Kinder) oder als Blatt (Target)", () => {
    expect(isMeasurableGoal({ progressMode: "kpi_tree", target: null, hasChildren: true })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "kpi_tree", target: 60, hasChildren: false })).toBe(
      true,
    );
    expect(isMeasurableGoal({ progressMode: "kpi_tree", target: null, hasChildren: false })).toBe(
      false,
    );
  });
});
