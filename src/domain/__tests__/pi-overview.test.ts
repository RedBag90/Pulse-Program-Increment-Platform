import { describe, it, expect } from "vitest";
import { summarizePiOverview, type PiOverviewInput } from "@/domain/pi-overview";

const EMPTY: PiOverviewInput = {
  sprints: [],
  features: [],
  objectives: [],
  impediments: [],
};

describe("summarizePiOverview", () => {
  it("returns zeroed metrics for empty input", () => {
    const s = summarizePiOverview(EMPTY);
    expect(s.velocity).toEqual({ plannedPoints: 0, completedPoints: 0 });
    expect(s.capacity).toEqual({ plannedCapacity: 0, sprintCount: 0 });
    expect(s.objectives).toEqual({ total: 0, committed: 0, avgConfidence: null });
    expect(s.impediments).toEqual({ open: 0, escalated: 0 });
    expect(s.featureStatus).toEqual([]);
  });

  it("sums planned points and counts only done/completed stories as completed", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      sprints: [
        {
          teamTargetVelocity: 20,
          stories: [
            { storyPoints: 5, status: "done" },
            { storyPoints: 3, status: "in_progress" },
            { storyPoints: 8, status: "completed" },
          ],
        },
      ],
    });
    expect(s.velocity.plannedPoints).toBe(16);
    expect(s.velocity.completedPoints).toBe(13);
  });

  it("treats missing story points as zero", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      sprints: [{ teamTargetVelocity: null, stories: [{ storyPoints: null, status: "done" }] }],
    });
    expect(s.velocity).toEqual({ plannedPoints: 0, completedPoints: 0 });
  });

  it("sums capacity across sprints and counts them", () => {
    const s = summarizePiOverview({
      ...EMPTY,
      sprints: [
        { teamTargetVelocity: 20, stories: [] },
        { teamTargetVelocity: 15, stories: [] },
        { teamTargetVelocity: null, stories: [] },
      ],
    });
    expect(s.capacity).toEqual({ plannedCapacity: 35, sprintCount: 3 });
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
