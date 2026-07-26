import { describe, it, expect } from "vitest";
import { canReparent, planReparent } from "@/domain/goal-reparent";

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

describe("planReparent — Subtree-Re-Materialisierung", () => {
  it("verschiebt Knoten + Nachfahren unter einen neuen Parent", () => {
    const writes = planReparent({
      node: { id: "N", path: "O/N", level: 1, themeId: "th_old", parentObjectiveId: "O" },
      parent: { path: "root/P", level: 1, themeId: "th_new" },
      newParentId: "P",
      subtree: [
        { id: "N", path: "O/N", level: 1 },
        { id: "D", path: "O/N/D", level: 2 },
      ],
    });
    // Bewegter Knoten: neue Basis + Level-Delta + geerbter themeId + parentObjectiveId.
    expect(writes[0]).toEqual({
      id: "N",
      path: "root/P/N",
      level: 2,
      themeId: "th_new",
      parentObjectiveId: "P",
    });
    // Nachfahre: Präfix umgeschrieben, gleicher Level-Delta, themeId geerbt, KEIN parentObjectiveId.
    expect(writes[1]).toEqual({ id: "D", path: "root/P/N/D", level: 3, themeId: "th_new" });
    expect("parentObjectiveId" in writes[1]!).toBe(false);
  });

  it("verschiebt auf die oberste Ebene (parent null): level 0, eigener themeId, parent null", () => {
    const writes = planReparent({
      node: { id: "N", path: "O/N", level: 1, themeId: "th_old", parentObjectiveId: "O" },
      parent: null,
      newParentId: null,
      subtree: [
        { id: "N", path: "O/N", level: 1 },
        { id: "D", path: "O/N/D", level: 2 },
      ],
    });
    expect(writes[0]).toEqual({
      id: "N",
      path: "N",
      level: 0,
      themeId: "th_old",
      parentObjectiveId: null,
    });
    expect(writes[1]).toEqual({ id: "D", path: "N/D", level: 1, themeId: "th_old" });
  });
});
