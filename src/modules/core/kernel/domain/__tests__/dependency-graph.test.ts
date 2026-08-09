import { describe, it, expect } from "vitest";
import { detectCycle, earliestStartFromBlockers } from "@/modules/core/kernel/domain/dependency-graph";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("detectCycle", () => {
  it("returns false when there are no existing edges", () => {
    expect(detectCycle("A", "B", [])).toBe(false);
  });

  it("detects a self-loop (A→A)", () => {
    expect(detectCycle("A", "A", [])).toBe(true);
  });

  it("detects a direct reverse edge (B→A when proposing A→B)", () => {
    expect(detectCycle("A", "B", [{ fromId: "B", toId: "A" }])).toBe(true);
  });

  it("detects an indirect cycle (A→B, B→C, proposing C→A)", () => {
    const edges = [
      { fromId: "A", toId: "B" },
      { fromId: "B", toId: "C" },
    ];
    expect(detectCycle("C", "A", edges)).toBe(true);
  });

  it("returns false when no path from toId reaches fromId (D→A with A→B, B→C)", () => {
    const edges = [
      { fromId: "A", toId: "B" },
      { fromId: "B", toId: "C" },
    ];
    expect(detectCycle("D", "A", edges)).toBe(false);
  });

  it("handles disconnected sub-graphs without false positives", () => {
    const edges = [
      { fromId: "X", toId: "Y" },
      { fromId: "Y", toId: "Z" },
      { fromId: "A", toId: "B" },
    ];
    // Proposing B→A — A and B are their own sub-graph, no path from B to A
    // Wait: A→B exists, proposing B→A, so path from A (proposedTo) back to B (proposedFrom) exists: A→B
    // Actually: proposedFrom=B, proposedTo=A, BFS from A → follows A→B → reaches B → cycle!
    expect(detectCycle("B", "A", edges)).toBe(true);
  });

  it("returns false for proposing D→E with no edges involving D or E", () => {
    const edges = [
      { fromId: "A", toId: "B" },
      { fromId: "B", toId: "C" },
    ];
    expect(detectCycle("D", "E", edges)).toBe(false);
  });

  it("handles longer chains without false positives", () => {
    // A→B→C→D, proposing E→A: no cycle
    const edges = [
      { fromId: "A", toId: "B" },
      { fromId: "B", toId: "C" },
      { fromId: "C", toId: "D" },
    ];
    expect(detectCycle("E", "A", edges)).toBe(false);
  });
});

describe("earliestStartFromBlockers — spätestes Blocker-Ende plus unscheduled-Liste", () => {
  it("returns null when there are no blockers (no constraint)", () => {
    expect(earliestStartFromBlockers([])).toEqual({ earliest: null, unscheduledBlockers: [] });
  });

  it("picks the latest end across multiple scheduled blockers", () => {
    const result = earliestStartFromBlockers([
      { blockerId: "b1", blockerTitle: "B1", blockerEndDate: utc("2026-03-31") },
      { blockerId: "b2", blockerTitle: "B2", blockerEndDate: utc("2026-06-30") },
      { blockerId: "b3", blockerTitle: "B3", blockerEndDate: utc("2026-04-30") },
    ]);
    expect(result.earliest).toEqual(utc("2026-06-30"));
    expect(result.unscheduledBlockers).toEqual([]);
  });

  it("collects unscheduled blockers but still folds the scheduled ones", () => {
    const result = earliestStartFromBlockers([
      { blockerId: "b1", blockerTitle: "B1", blockerEndDate: utc("2026-04-30") },
      { blockerId: "b2", blockerTitle: "Unscheduled-A", blockerEndDate: null },
      { blockerId: "b3", blockerTitle: "Unscheduled-B", blockerEndDate: null },
    ]);
    expect(result.earliest).toEqual(utc("2026-04-30"));
    expect(result.unscheduledBlockers).toEqual(["Unscheduled-A", "Unscheduled-B"]);
  });

  it("returns null when every blocker is unscheduled (constraint is 'unknown')", () => {
    const result = earliestStartFromBlockers([
      { blockerId: "b1", blockerTitle: "U1", blockerEndDate: null },
      { blockerId: "b2", blockerTitle: "U2", blockerEndDate: null },
    ]);
    expect(result.earliest).toBeNull();
    expect(result.unscheduledBlockers).toEqual(["U1", "U2"]);
  });
});
