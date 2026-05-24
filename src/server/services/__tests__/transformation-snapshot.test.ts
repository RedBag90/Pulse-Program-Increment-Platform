import { describe, it, expect } from "vitest";
import {
  computeSnapshotMetrics,
  snapshotDay,
  sparklinePoints,
  type SnapshotGoalInput,
} from "@/server/services/transformation-snapshot";

const kpi = (baseline: number, target: number, current: number | null) => ({
  baseline,
  target,
  current,
});

describe("computeSnapshotMetrics", () => {
  it("returns zeroed metrics for no goals", () => {
    expect(computeSnapshotMetrics([])).toEqual({
      goalAchievement: 0,
      goalCount: 0,
      achievedGoalCount: 0,
    });
  });

  it("excludes archived goals from every count", () => {
    const goals: SnapshotGoalInput[] = [
      { status: "active", kpis: [kpi(0, 10, 5)] },
      { status: "archived", kpis: [kpi(0, 10, 0)] },
    ];
    const m = computeSnapshotMetrics(goals);
    expect(m.goalCount).toBe(1);
    expect(m.goalAchievement).toBeCloseTo(0.5);
  });

  it("counts achieved goals and includes them in goalCount but not in achievement", () => {
    const goals: SnapshotGoalInput[] = [
      { status: "achieved", kpis: [kpi(0, 10, 10)] },
      { status: "active", kpis: [kpi(0, 10, 2)] },
    ];
    const m = computeSnapshotMetrics(goals);
    expect(m.goalCount).toBe(2);
    expect(m.achievedGoalCount).toBe(1);
    // Only the active goal with KPIs drives achievement → 0.2
    expect(m.goalAchievement).toBeCloseTo(0.2);
  });

  it("ignores active goals without KPIs when averaging achievement", () => {
    const goals: SnapshotGoalInput[] = [
      { status: "active", kpis: [kpi(0, 10, 10)] }, // 1.0
      { status: "active", kpis: [] }, // ignored
    ];
    const m = computeSnapshotMetrics(goals);
    expect(m.goalCount).toBe(2);
    expect(m.goalAchievement).toBe(1);
  });

  it("yields zero achievement when no active goal carries KPIs", () => {
    const goals: SnapshotGoalInput[] = [{ status: "active", kpis: [] }];
    expect(computeSnapshotMetrics(goals).goalAchievement).toBe(0);
  });
});

describe("snapshotDay", () => {
  it("truncates to UTC midnight of the given instant", () => {
    const d = snapshotDay(new Date("2026-05-24T15:42:10.000Z"));
    expect(d.toISOString()).toBe("2026-05-24T00:00:00.000Z");
  });
});

describe("sparklinePoints", () => {
  it("maps a single value to the right edge with inverted y", () => {
    const pts = sparklinePoints([0.25], 100, 40);
    expect(pts).toEqual([{ x: 100, y: 30 }]); // y = 40 * (1 - 0.25)
  });

  it("spreads multiple values evenly across the width", () => {
    const pts = sparklinePoints([0, 0.5, 1], 100, 40);
    expect(pts).toEqual([
      { x: 0, y: 40 }, // 0 → bottom
      { x: 50, y: 20 }, // 0.5 → middle
      { x: 100, y: 0 }, // 1 → top
    ]);
  });

  it("clamps values outside 0..1 onto the canvas", () => {
    const pts = sparklinePoints([-1, 2], 100, 40);
    expect(pts[0]).toEqual({ x: 0, y: 40 }); // clamped to 0
    expect(pts[1]).toEqual({ x: 100, y: 0 }); // clamped to 1
  });
});
