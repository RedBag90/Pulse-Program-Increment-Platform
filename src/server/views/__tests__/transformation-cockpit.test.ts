import { describe, it, expect } from "vitest";
import { buildCockpitModel } from "@/server/views/transformation-cockpit";

const kpi = (baseline: number | null, target: number, current: number | null) => ({
  baseline,
  target,
  current,
});

describe("buildCockpitModel", () => {
  it("summarises active goals and skips archived ones", () => {
    const m = buildCockpitModel({
      goals: [
        { id: "g1", title: "G1", status: "active", kpis: [kpi(0, 10, 5)], epicLinks: [1, 2] },
        { id: "g2", title: "G2", status: "archived", kpis: [kpi(0, 10, 10)], epicLinks: [] },
      ],
      snapshots: [],
      activeModel: null,
      outcomes: [],
    });
    expect(m.goals).toHaveLength(1);
    expect(m.goals[0]).toMatchObject({ id: "g1", kpiProgress: 0.5, kpiCount: 1, epicCount: 2 });
    expect(m.model).toBeNull();
  });

  it("builds the trend with serialised dates, sparkline points and first achievement", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [
        {
          capturedOn: new Date("2026-05-01T12:00:00Z"),
          goalAchievement: 0.2,
          achievedGoalCount: 0,
          goalCount: 3,
        },
        {
          capturedOn: new Date("2026-05-08T12:00:00Z"),
          goalAchievement: 0.6,
          achievedGoalCount: 1,
          goalCount: 3,
        },
      ],
      activeModel: null,
      outcomes: [],
    });
    expect(m.trend.snapshots.map((s) => s.capturedOn)).toEqual(["2026-05-01", "2026-05-08"]);
    expect(m.trend.points).toHaveLength(2);
    expect(m.trend.firstAchievement).toEqual({ capturedOn: "2026-05-08" });
  });

  it("serialises the model and keeps only goal-unbound outcomes", () => {
    const m = buildCockpitModel({
      goals: [],
      snapshots: [],
      activeModel: {
        template: "lace",
        status: "active",
        targetDate: new Date("2026-12-31T00:00:00Z"),
      },
      outcomes: [
        {
          id: "o1",
          title: "O1",
          metricUnit: "%",
          baseline: 0,
          target: 100,
          current: 40,
          dueDate: new Date("2026-06-30T00:00:00Z"),
          goalId: null,
        },
        {
          id: "o2",
          title: "O2",
          metricUnit: null,
          baseline: null,
          target: 10,
          current: null,
          dueDate: null,
          goalId: "g1",
        },
      ],
    });
    expect(m.model?.targetDate).toBe("2026-12-31");
    expect(m.model?.template).toBe("lace");
    expect(m.outcomes).toHaveLength(1);
    expect(m.outcomes[0]).toMatchObject({ id: "o1", dueDate: "2026-06-30" });
  });
});
