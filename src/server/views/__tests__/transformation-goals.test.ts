import { describe, it, expect } from "vitest";
import { buildGoalsPageModel } from "@/server/views/transformation-goals";

const baseGoal = (
  over: Partial<{
    id: string;
    title: string;
    status: string;
    ownerId: string | null;
    dueDate: Date | null;
    description: string | null;
  }>,
) => ({
  id: "g1",
  title: "Goal",
  description: null,
  ownerId: null,
  dueDate: null,
  status: "active",
  kpis: [],
  epicLinks: [],
  ...over,
});

const outcome = (over: {
  id: string;
  goalId: string | null;
  target: number;
  current?: number | null;
  baseline?: number | null;
  dueDate?: Date | null;
}) => ({
  id: over.id,
  title: `KPI ${over.id}`,
  metricUnit: "%",
  baseline: over.baseline ?? 0,
  target: over.target,
  current: over.current ?? null,
  dueDate: over.dueDate ?? null,
  goalId: over.goalId,
});

describe("buildGoalsPageModel", () => {
  it("splits outcomes into bound (per goal) and unbound", () => {
    const m = buildGoalsPageModel({
      goals: [baseGoal({ id: "g1" }), baseGoal({ id: "g2", title: "Goal 2" })],
      outcomes: [
        outcome({ id: "k1", goalId: "g1", target: 10 }),
        outcome({ id: "k2", goalId: "g2", target: 5 }),
        outcome({ id: "k3", goalId: null, target: 3 }),
      ],
      epics: [],
      userLabels: {},
    });
    expect(m.goals.find((g) => g.id === "g1")!.kpis.map((k) => k.id)).toEqual(["k1"]);
    expect(m.goals.find((g) => g.id === "g2")!.kpis.map((k) => k.id)).toEqual(["k2"]);
    expect(m.unboundKpis.map((k) => k.id)).toEqual(["k3"]);
  });

  it("computes RAG tier from KPI progress with achieved → done", () => {
    const m = buildGoalsPageModel({
      goals: [
        baseGoal({ id: "g-red", status: "active" }),
        baseGoal({ id: "g-amber", status: "active" }),
        baseGoal({ id: "g-green", status: "active" }),
        baseGoal({ id: "g-done", status: "achieved" }),
      ],
      outcomes: [
        outcome({ id: "kr", goalId: "g-red", target: 10, current: 1 }), // 10% → red
        outcome({ id: "ka", goalId: "g-amber", target: 10, current: 5 }), // 50% → amber
        outcome({ id: "kg", goalId: "g-green", target: 10, current: 9 }), // 90% → green
        // g-done deliberately has no KPIs to confirm `done` overrides 0% progress
      ],
      epics: [],
      userLabels: {},
    });
    expect(m.goals.find((g) => g.id === "g-red")!.tier).toBe("red");
    expect(m.goals.find((g) => g.id === "g-amber")!.tier).toBe("amber");
    expect(m.goals.find((g) => g.id === "g-green")!.tier).toBe("green");
    expect(m.goals.find((g) => g.id === "g-done")!.tier).toBe("done");
  });

  it("serialises ISO-day strings for dueDate (goal + KPI)", () => {
    const m = buildGoalsPageModel({
      goals: [baseGoal({ id: "g1", dueDate: new Date("2026-12-31T00:00:00Z") })],
      outcomes: [
        outcome({
          id: "k1",
          goalId: "g1",
          target: 10,
          dueDate: new Date("2026-06-30T00:00:00Z"),
        }),
      ],
      epics: [],
      userLabels: {},
    });
    expect(m.goals[0]!.dueDate).toBe("2026-12-31");
    expect(m.goals[0]!.kpis[0]!.dueDate).toBe("2026-06-30");
  });

  it("emits epic + user options ready for the editor pickers", () => {
    const m = buildGoalsPageModel({
      goals: [],
      outcomes: [],
      epics: [
        { id: "e1", title: "Epic One" },
        { id: "e2", title: "Epic Two" },
      ],
      userLabels: { u1: "Alice", u2: "Bob" },
    });
    expect(m.epicOptions).toEqual([
      { id: "e1", title: "Epic One" },
      { id: "e2", title: "Epic Two" },
    ]);
    expect(m.userOptions).toEqual([
      { id: "u1", label: "Alice" },
      { id: "u2", label: "Bob" },
    ]);
  });

  it("kpiProgress is 0 when a goal has no bound KPIs", () => {
    const m = buildGoalsPageModel({
      goals: [baseGoal({ id: "g1" })],
      outcomes: [],
      epics: [],
      userLabels: {},
    });
    expect(m.goals[0]!.kpiProgress).toBe(0);
    expect(m.goals[0]!.kpis).toEqual([]);
  });
});
