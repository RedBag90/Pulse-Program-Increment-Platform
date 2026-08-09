import { describe, it, expect } from "vitest";
import { summarizePiOverview, type PiOverviewInput } from "@/modules/drumbeat/domain/pi-overview";

const EMPTY: PiOverviewInput = {
  teams: [],
  piDurationDays: 70,
  features: [],
  objectives: [],
  impediments: [],
};

describe("summarizePiOverview", () => {
  it("returns zeroed metrics for empty input", () => {
    const s = summarizePiOverview(EMPTY);
    expect(s.capacity).toEqual({ plannedCapacity: 0 });
    expect(s.objectives).toEqual({ total: 0, committed: 0, avgConfidence: null });
    expect(s.impediments).toEqual({ open: 0, escalated: 0 });
    expect(s.featureStatus).toEqual([]);
  });

  it("sums team velocity over a 70-day PI (5 sprints) as capacity", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      teams: [{ targetVelocity: 20 }, { targetVelocity: 15 }, { targetVelocity: null }],
    });
    // 70 days / 14 = 5 sprints; (20 + 15 + 0) * 5 = 175
    expect(s.capacity.plannedCapacity).toBe(175);
  });

  it("falls back to at least one sprint when piDurationDays is short", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      piDurationDays: 7,
      teams: [{ targetVelocity: 20 }],
    });
    // Math.round(7/14)=1 sprint
    expect(s.capacity.plannedCapacity).toBe(20);
  });

  it("counts committed objectives and averages confidence, ignoring nulls", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      objectives: [
        { committed: true, confidence: 4 },
        { committed: true, confidence: 5 },
        { committed: false, confidence: null },
      ],
    });
    expect(s.objectives).toEqual({ total: 3, committed: 2, avgConfidence: 4.5 });
  });

  it("reports null average confidence when no objective is rated", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      objectives: [{ committed: true, confidence: null }],
    });
    expect(s.objectives.avgConfidence).toBeNull();
  });

  it("counts open and escalated impediments separately, ignoring resolved", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      impediments: [
        { status: "open" },
        { status: "open" },
        { status: "escalated" },
        { status: "resolved" },
      ],
    });
    expect(s.impediments).toEqual({ open: 2, escalated: 1 });
  });

  it("groups features by status", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      features: [{ status: "draft" }, { status: "in_progress" }, { status: "in_progress" }],
    });
    expect(s.featureStatus).toEqual(
      expect.arrayContaining([
        { status: "draft", count: 1 },
        { status: "in_progress", count: 2 },
      ]),
    );
    expect(s.featureStatus).toHaveLength(2);
  });
});
