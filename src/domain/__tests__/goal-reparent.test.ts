import { describe, it, expect } from "vitest";
import { canReparent } from "@/domain/goal-reparent";

describe("canReparent", () => {
  it("allows moving to the top level (targetId null)", () => {
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: null, targetPath: null })).toBe(
      true,
    );
  });

  it("rejects moving a node under itself", () => {
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: "B", targetPath: "A/B" })).toBe(
      false,
    );
  });

  it("rejects moving a node under one of its descendants", () => {
    // B has descendant C at path A/B/C
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: "C", targetPath: "A/B/C" })).toBe(
      false,
    );
    expect(
      canReparent({ nodeId: "B", nodePath: "A/B", targetId: "D", targetPath: "A/B/C/D" }),
    ).toBe(false);
  });

  it("allows moving under an ancestor or a sibling elsewhere", () => {
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: "A", targetPath: "A" })).toBe(
      true,
    );
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: "X", targetPath: "X/Y" })).toBe(
      true,
    );
  });

  it("does not treat a path-prefix sibling as a descendant", () => {
    // "A/BC" is not a descendant of "A/B" even though it shares the prefix "A/B".
    expect(canReparent({ nodeId: "B", nodePath: "A/B", targetId: "BC", targetPath: "A/BC" })).toBe(
      true,
    );
  });
});
