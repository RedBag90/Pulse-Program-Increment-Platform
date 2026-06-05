import { describe, it, expect } from "vitest";
import { recentChanges, ragTier, type DeltaSnapshot } from "@/domain/transformation-delta";

const snap = (over: Partial<DeltaSnapshot> = {}): DeltaSnapshot => ({
  goalAchievement: 0,
  structureProgress: 0,
  goalCount: 0,
  achievedGoalCount: 0,
  ...over,
});

describe("recentChanges", () => {
  it("is empty when no previous snapshot exists", () => {
    expect(recentChanges(null, snap())).toEqual([]);
    expect(recentChanges(snap(), null)).toEqual([]);
    expect(recentChanges(null, null)).toEqual([]);
  });

  it("returns no entries when nothing moved beyond the noise threshold", () => {
    const a = snap({ goalAchievement: 0.5, structureProgress: 0.5 });
    const b = snap({ goalAchievement: 0.505, structureProgress: 0.495 });
    expect(recentChanges(a, b)).toEqual([]);
  });

  it("reports goal-achievement and structure-progress moves with direction", () => {
    const prev = snap({ goalAchievement: 0.5, structureProgress: 0.4 });
    const next = snap({ goalAchievement: 0.55, structureProgress: 0.3 });
    const changes = recentChanges(prev, next);
    expect(changes.map((c) => c.kind)).toEqual(["structure_progress", "goal_achievement"]);
    expect(changes[0]!.direction).toBe("down");
    expect(changes[0]!.delta).toBeCloseTo(-0.1, 5);
    expect(changes[1]!.direction).toBe("up");
  });

  it("ranks a newly-achieved goal above similarly-sized %-moves", () => {
    const prev = snap({ goalAchievement: 0.6, achievedGoalCount: 1 });
    const next = snap({ goalAchievement: 0.65, achievedGoalCount: 2 });
    const changes = recentChanges(prev, next);
    expect(changes[0]!.kind).toBe("achieved_goals");
    expect(changes[0]!.delta).toBe(1);
    expect(changes[1]!.kind).toBe("goal_achievement");
  });

  it("tracks goalCount additions and removals", () => {
    const prev = snap({ goalCount: 5 });
    const next = snap({ goalCount: 7 });
    const changes = recentChanges(prev, next);
    expect(changes).toEqual([
      { kind: "goal_count", label: "Anzahl Ziele", delta: 2, direction: "up" },
    ]);
  });

  it("caps the result at 4 entries", () => {
    const prev = snap({
      goalAchievement: 0.5,
      structureProgress: 0.5,
      achievedGoalCount: 1,
      goalCount: 5,
    });
    const next = snap({
      goalAchievement: 0.6,
      structureProgress: 0.4,
      achievedGoalCount: 2,
      goalCount: 6,
    });
    expect(recentChanges(prev, next)).toHaveLength(4);
  });
});

describe("ragTier", () => {
  it("classifies values into red / amber / green bands", () => {
    expect(ragTier(0)).toBe("red");
    expect(ragTier(0.29)).toBe("red");
    expect(ragTier(0.3)).toBe("amber");
    expect(ragTier(0.69)).toBe("amber");
    expect(ragTier(0.7)).toBe("green");
    expect(ragTier(1)).toBe("green");
  });

  it("returns `done` regardless of value when achieved is true", () => {
    expect(ragTier(0, true)).toBe("done");
    expect(ragTier(1, true)).toBe("done");
  });
});
