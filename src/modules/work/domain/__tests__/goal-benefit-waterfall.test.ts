import { describe, it, expect } from "vitest";
import {
  maturityBand,
  buildGoalWaterfall,
  type GoalWaterfallGoal,
  type GoalWaterfallEpic,
} from "@/modules/work/domain/goal-benefit-waterfall";

const goal = (over: Partial<GoalWaterfallGoal> = {}): GoalWaterfallGoal => ({
  id: "g1",
  title: "ARR-Wachstum",
  target: 100,
  metricType: "currency",
  metricUnit: null,
  currencyCode: "EUR",
  precision: 0,
  ...over,
});

describe("maturityBand", () => {
  it("L0–L3 → estimate", () => {
    for (const g of ["L0", "L1", "L2", "L3"] as const)
      expect(maturityBand(g, null)).toBe("estimate");
  });
  it("L4 & L4.1 (oder ohne Sub-Stage) → achieved_gap", () => {
    expect(maturityBand("L4", "L4.1")).toBe("achieved_gap");
    expect(maturityBand("L4", null)).toBe("achieved_gap");
  });
  it("L4 & L4.2 → actual, L5 → actual", () => {
    expect(maturityBand("L4", "L4.2")).toBe("actual");
    expect(maturityBand("L5", null)).toBe("actual");
  });
});

describe("buildGoalWaterfall", () => {
  const epics: GoalWaterfallEpic[] = [
    { epicId: "a", gate: "L1", subStage: null, planned: 20, realized: 0 }, // estimate → forecast 20
    { epicId: "b", gate: "L4", subStage: "L4.1", planned: 30, realized: 12 }, // achieved 12 + gap 18
    { epicId: "c", gate: "L5", subStage: null, planned: 25, realized: 25 }, // actual 25
  ];

  it("routet Beiträge bandgerecht in solid/forecast je Gate", () => {
    const wf = buildGoalWaterfall(goal(), epics, null);
    const byKey = new Map(wf.steps.map((s) => [s.key, s]));
    expect(byKey.get("L1")).toMatchObject({ solid: 0, forecast: 20 });
    expect(byKey.get("L4")).toMatchObject({ solid: 12, forecast: 18 });
    expect(byKey.get("L5")).toMatchObject({ solid: 25, forecast: 0 });
    // leere Gates bleiben 0
    expect(byKey.get("L0")).toMatchObject({ solid: 0, forecast: 0 });
  });

  it("baut den Sockel (base) kumulativ auf", () => {
    const wf = buildGoalWaterfall(goal(), epics, null);
    const byKey = new Map(wf.steps.map((s) => [s.key, s]));
    // L0..L3: nur L1 trägt 20 → L4 startet bei 20
    expect(byKey.get("L4")!.base).toBe(20);
    // L4 fügt 30 hinzu (12+18) → L5 startet bei 50
    expect(byKey.get("L5")!.base).toBe(50);
  });

  it("berechnet total + Deckungslücke gegen den Zielwert", () => {
    const wf = buildGoalWaterfall(goal({ target: 100 }), epics, null);
    expect(wf.total).toBe(75); // 20 + 30 + 25
    expect(wf.gap).toBe(25);
    expect(wf.overshoot).toBe(0);
    const gapStep = wf.steps.find((s) => s.kind === "gap");
    expect(gapStep).toMatchObject({ base: 75, forecast: 25 });
    const totalStep = wf.steps.find((s) => s.kind === "total");
    expect(totalStep).toMatchObject({ base: 0, solid: 75 });
  });

  it("zeigt Übererfüllung ohne Lücken-Balken", () => {
    const wf = buildGoalWaterfall(goal({ target: 50 }), epics, null);
    expect(wf.total).toBe(75);
    expect(wf.gap).toBe(0);
    expect(wf.overshoot).toBe(25);
    expect(wf.steps.some((s) => s.kind === "gap")).toBe(false);
  });

  it("respektiert den Projekt-ID-Filter (selectedEpicIds)", () => {
    const wf = buildGoalWaterfall(goal(), epics, new Set(["c"]));
    expect(wf.total).toBe(25);
    const byKey = new Map(wf.steps.map((s) => [s.key, s]));
    expect(byKey.get("L1")).toMatchObject({ forecast: 0 });
    expect(byKey.get("L5")).toMatchObject({ solid: 25 });
  });

  it("leere Auswahl → total 0, volle Lücke", () => {
    const wf = buildGoalWaterfall(goal({ target: 100 }), epics, new Set());
    expect(wf.total).toBe(0);
    expect(wf.gap).toBe(100);
  });
});
