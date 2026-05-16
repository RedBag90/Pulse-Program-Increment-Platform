import { describe, it, expect } from "vitest";
import { detectCycle } from "@/domain/dependency-graph";

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
