import { describe, it, expect } from "vitest";
import {
  goalSetupSteps,
  GOAL_SETUP_STEPS,
  type GoalSetupNode,
} from "@/modules/core/goals/domain/goal-setup";

function node(over: Partial<GoalSetupNode> = {}): GoalSetupNode {
  return {
    id: "n1",
    period: null,
    periodStart: null,
    ownerId: null,
    target: null,
    latestCheckin: null,
    status: null,
    children: [],
    ...over,
  };
}

/** key of the single `current` step, or null when complete. */
function current(themes: GoalSetupNode[]): string | null {
  return goalSetupSteps(themes).steps.find((s) => s.status === "current")?.key ?? null;
}

describe("goalSetupSteps", () => {
  it("has the 5 ordered steps with descriptions", () => {
    expect(GOAL_SETUP_STEPS).toHaveLength(5);
    expect(GOAL_SETUP_STEPS.every((s) => s.description.length > 0)).toBe(true);
    expect(GOAL_SETUP_STEPS[0]!.key).toBe("create");
  });

  it("empty tree → step 1 (create) current, none done, not complete", () => {
    const res = goalSetupSteps([]);
    expect(res.complete).toBe(false);
    expect(res.steps[0]!.status).toBe("current");
    expect(res.steps.slice(1).every((s) => s.status === "upcoming")).toBe(true);
    expect(res.steps[0]!.actionGoalId).toBeNull(); // create has no target goal
  });

  it("one bare goal (title only) → create done, Zeitraum current with a target goal", () => {
    const res = goalSetupSteps([node({ id: "g1" })]);
    expect(res.steps[0]!.status).toBe("done");
    expect(res.steps[1]!.key).toBe("period");
    expect(res.steps[1]!.status).toBe("current");
    expect(res.steps[1]!.actionGoalId).toBe("g1"); // open g1 to set the period
  });

  it("period + owner set → Messgröße current", () => {
    expect(current([node({ id: "g1", period: "2026-Q1", ownerId: "u1" })])).toBe("metric");
  });

  it("periodStart range also satisfies the period step", () => {
    expect(current([node({ period: null, periodStart: "2026-01-01" })])).toBe("owner");
  });

  it("rollup parent (children, no own target) satisfies the metric step", () => {
    const parent = node({ id: "p", period: "2026", ownerId: "u1", children: [node({ id: "c" })] });
    // parent lacks target but has a child → metric done → Status-Update current
    expect(current([parent])).toBe("checkin");
  });

  it("fully set → complete, no current", () => {
    const res = goalSetupSteps([
      node({
        id: "g1",
        period: "2026-Q1",
        ownerId: "u1",
        target: 100,
        latestCheckin: { status: "on_track" },
      }),
    ]);
    expect(res.complete).toBe(true);
    expect(res.steps.every((s) => s.status === "done")).toBe(true);
    expect(res.steps.some((s) => s.status === "current")).toBe(false);
  });

  it("status without a check-in also satisfies the last step", () => {
    const res = goalSetupSteps([
      node({ period: "2026", ownerId: "u1", target: 100, status: "at_risk" }),
    ]);
    expect(res.complete).toBe(true);
  });
});
