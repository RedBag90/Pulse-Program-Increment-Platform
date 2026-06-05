import { describe, it, expect } from "vitest";
import { buildCockpitModel } from "@/server/views/transformation-cockpit";
import type { StructureGap, PracticeAdoption } from "@/server/services/transformation";

const kpi = (baseline: number | null, target: number, current: number | null) => ({
  baseline,
  target,
  current,
});

const emptyGap: StructureGap = {
  hasTarget: false,
  targetDate: null,
  dimensions: [],
  overallProgress: 0,
};

const emptyAdoption: PracticeAdoption = { hasTarget: false, signals: [] };

const sampleGap: StructureGap = {
  hasTarget: true,
  targetDate: new Date("2026-12-31T00:00:00Z"),
  dimensions: [
    { key: "valueStreams", label: "Wertströme", ist: 3, soll: 3, progress: 1 },
    { key: "arts", label: "ARTs", ist: 3, soll: 3, progress: 1 },
    { key: "teams", label: "Teams", ist: 10, soll: 12, progress: 10 / 12 },
  ],
  overallProgress: (1 + 1 + 10 / 12) / 3,
};

const sampleAdoption: PracticeAdoption = {
  hasTarget: true,
  signals: [
    { key: "wsjf", label: "WSJF-Priorisierung", value: 0.9, detail: "95/105 Features bewertet" },
    { key: "featureQs", label: "Feature-QS", value: 0.16, detail: "17/105 Features freigegeben" },
  ],
};

describe("buildCockpitModel", () => {
  it("summarises active goals with RAG tier and bound outcomes", () => {
    const m = buildCockpitModel({
      goals: [
        { id: "g1", title: "G1", status: "active", kpis: [kpi(0, 10, 8)], epicLinks: [1, 2] },
        { id: "g2", title: "G2", status: "archived", kpis: [kpi(0, 10, 10)], epicLinks: [] },
        { id: "g3", title: "G3", status: "achieved", kpis: [], epicLinks: [1] },
      ],
      snapshots: [],
      activeModel: null,
      outcomes: [
        {
          id: "o-bound",
          title: "Bound KPI",
          metricUnit: "%",
          baseline: 0,
          target: 100,
          current: 50,
          dueDate: null,
          goalId: "g1",
        },
        {
          id: "o-free",
          title: "Free outcome",
          metricUnit: null,
          baseline: null,
          target: 10,
          current: null,
          dueDate: null,
          goalId: null,
        },
      ],
      gap: emptyGap,
      adoption: emptyAdoption,
    });

    expect(m.goals).toHaveLength(2);
    const g1 = m.goals.find((g) => g.id === "g1")!;
    expect(g1.tier).toBe("green"); // 0.8 KPI progress
    expect(g1.boundOutcomes).toHaveLength(1);
    expect(g1.boundOutcomes[0]).toMatchObject({ id: "o-bound", current: 50 });

    const g3 = m.goals.find((g) => g.id === "g3")!;
    expect(g3.tier).toBe("done");

    // Unbound outcomes only
    expect(m.outcomes).toHaveLength(1);
    expect(m.outcomes[0]!.id).toBe("o-free");
  });

  it("shapes structure + practice chips with RAG tiers", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [],
      activeModel: null,
      outcomes: [],
      gap: sampleGap,
      adoption: sampleAdoption,
    });
    expect(m.structure.map((c) => [c.key, c.tier, c.gap])).toEqual([
      ["valueStreams", "green", 0],
      ["arts", "green", 0],
      ["teams", "amber", 2],
    ]);
    expect(m.practices.map((c) => [c.key, c.tier])).toEqual([
      ["wsjf", "green"],
      ["featureQs", "red"],
    ]);
  });

  it("emits nextSteps via deriveNextSteps so the drawer reads from the model", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [],
      activeModel: null,
      outcomes: [],
      gap: sampleGap,
      adoption: sampleAdoption,
    });
    // teams gap → 1 step; featureQs adoption < 0.5 → 1 step
    expect(m.nextSteps.length).toBeGreaterThanOrEqual(2);
    expect(m.nextSteps.some((s) => s.key === "struct-teams")).toBe(true);
    expect(m.nextSteps.some((s) => s.key === "prac-featureQs")).toBe(true);
  });

  it("computes hero delta against the first snapshot in the window", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [
        {
          capturedOn: new Date("2026-05-01T12:00:00Z"),
          goalAchievement: 0.2,
          structureProgress: 0.4,
          achievedGoalCount: 0,
          goalCount: 3,
        },
        {
          capturedOn: new Date("2026-05-08T12:00:00Z"),
          goalAchievement: 0.6,
          structureProgress: 0.6,
          achievedGoalCount: 1,
          goalCount: 3,
        },
      ],
      activeModel: null,
      outcomes: [],
      gap: emptyGap,
      adoption: emptyAdoption,
    });
    expect(m.hero.hasSnapshot).toBe(true);
    expect(m.hero.sollReife).toBeCloseTo(0.6, 5);
    expect(m.hero.delta).not.toBeNull();
    expect(m.hero.delta!.value).toBeCloseTo(0.4, 5);
    expect(m.hero.delta!.days).toBe(7);
  });

  it("emits recentChanges from the last two snapshots only", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [
        {
          capturedOn: new Date("2026-05-01T12:00:00Z"),
          goalAchievement: 0.2,
          structureProgress: 0.4,
          achievedGoalCount: 0,
          goalCount: 3,
        },
        {
          capturedOn: new Date("2026-05-08T12:00:00Z"),
          goalAchievement: 0.5,
          structureProgress: 0.4,
          achievedGoalCount: 1,
          goalCount: 3,
        },
      ],
      activeModel: null,
      outcomes: [],
      gap: emptyGap,
      adoption: emptyAdoption,
    });
    expect(m.recentChanges.length).toBeGreaterThan(0);
    // achieved_goals takes precedence over the %-move
    expect(m.recentChanges[0]!.kind).toBe("achieved_goals");
  });

  it("returns no delta and no recentChanges with one snapshot", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [
        {
          capturedOn: new Date("2026-05-08T12:00:00Z"),
          goalAchievement: 0.5,
          structureProgress: 0.4,
          achievedGoalCount: 0,
          goalCount: 3,
        },
      ],
      activeModel: null,
      outcomes: [],
      gap: emptyGap,
      adoption: emptyAdoption,
    });
    expect(m.hero.delta).toBeNull();
    expect(m.recentChanges).toEqual([]);
  });

  it("serialises the model template and target date", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [],
      activeModel: {
        template: "essential_safe",
        status: "active",
        targetDate: new Date("2026-12-31T00:00:00Z"),
      },
      outcomes: [],
      gap: emptyGap,
      adoption: emptyAdoption,
    });
    expect(m.model?.template).toBe("essential_safe");
    expect(m.model?.targetDate).toBe("2026-12-31");
  });
});
