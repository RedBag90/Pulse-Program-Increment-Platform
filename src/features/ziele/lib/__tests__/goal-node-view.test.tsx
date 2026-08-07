import { describe, it, expect } from "vitest";
import type { GoalNode } from "@/server/views/ziele-view";
import {
  goalNodeProgress,
  goalNodeTimeframeLabel,
  goalNodeOwner,
  goalInitials,
  isGoalDrifting,
  isGoalOffTrack,
} from "@/features/ziele/lib/goal-node-view";
import type { RollupTrio } from "@/domain/goals-rollup";

const trio = (over: Partial<RollupTrio> = {}): RollupTrio =>
  ({ planned: 0, realized: 0, runRate: 0, ...over }) as RollupTrio;

/** Minimaler GoalNode für die reinen View-Ableitungen (nur gelesene Felder). */
const node = (over: Partial<GoalNode> = {}): GoalNode =>
  ({
    period: null,
    periodStart: null,
    periodEnd: null,
    status: null,
    progress: null,
    isMeasurable: false,
    baseline: null,
    target: null,
    current: null,
    ownerId: null,
    trio: trio(),
    ...over,
  }) as GoalNode;

describe("goalNodeProgress", () => {
  it("bevorzugt den aufgelösten progress", () => {
    expect(goalNodeProgress(node({ progress: 0.42 }))).toBe(0.42);
  });

  it("messbares Blatt ohne progress → keyResultProgress (baseline→target→current)", () => {
    expect(
      goalNodeProgress(node({ isMeasurable: true, baseline: 0, target: 100, current: 50 })),
    ).toBe(0.5);
  });

  it("nicht messbar und kein progress → 0", () => {
    expect(goalNodeProgress(node())).toBe(0);
  });
});

describe("goalNodeTimeframeLabel", () => {
  it("Range gewinnt über Bucket", () => {
    const label = goalNodeTimeframeLabel(
      node({
        period: "2026-Q1",
        periodStart: "2026-03-01T00:00:00.000Z",
        periodEnd: "2026-06-30T00:00:00.000Z",
      }),
    );
    expect(label).toContain("Mär");
    expect(label).toContain("Jun");
  });

  it("kein Zeitraum → —", () => {
    expect(goalNodeTimeframeLabel(node())).toBe("—");
  });
});

describe("goalNodeOwner", () => {
  it("löst die Owner-Id gegen die Label-Map auf", () => {
    expect(goalNodeOwner(node({ ownerId: "u1" }), { u1: "Alex Fern" })).toBe("Alex Fern");
  });
  it("unbekannter/leerer Owner → null", () => {
    expect(goalNodeOwner(node({ ownerId: "u1" }), {})).toBeNull();
    expect(goalNodeOwner(node(), { u1: "x" })).toBeNull();
  });
});

describe("goalInitials (kanonisch — @-Suffix entfällt)", () => {
  it("zwei Wörter → zwei Initialen", () => {
    expect(goalInitials("Alex Fern")).toBe("AF");
  });
  it("E-Mail: Suffix entfällt, dann Wortlogik", () => {
    expect(goalInitials("alex.fern@example.com")).toBe("AL");
    expect(goalInitials("Alex Fern <a@b.c>")).toBe("AF");
  });
  it("ein Wort → erste zwei Zeichen", () => {
    expect(goalInitials("Madonna")).toBe("MA");
  });
});

describe("off-track / drift", () => {
  it("Status at_risk/off_track ist off-track (auch ohne Drift)", () => {
    expect(isGoalOffTrack(node({ status: "at_risk" }))).toBe(true);
    expect(isGoalOffTrack(node({ status: "off_track" }))).toBe(true);
  });
  it("On-track-Status ohne Drift ist nicht off-track", () => {
    expect(isGoalOffTrack(node({ status: "on_track" }))).toBe(false);
  });
  it("Drift (Run-Rate unter Schwelle) ist off-track und drifting", () => {
    const drifting = node({ status: "on_track", trio: trio({ planned: 100, realized: 10 }) });
    expect(isGoalDrifting(drifting)).toBe(true);
    expect(isGoalOffTrack(drifting)).toBe(true);
  });
});
