import { describe, it, expect } from "vitest";
import {
  canReparent,
  dropPlacement,
  planDrop,
  planReparent,
  reorderSiblingIds,
} from "@/modules/core/goals/domain/goal-reparent";

describe("reorderSiblingIds", () => {
  const base = ["a", "b", "c", "d"];

  it("inserts before the anchor (Mitte)", () => {
    expect(reorderSiblingIds(base, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("inserts at the front", () => {
    expect(reorderSiblingIds(base, "c", "a")).toEqual(["c", "a", "b", "d"]);
  });

  it("appends when beforeId is null", () => {
    expect(reorderSiblingIds(base, "a", null)).toEqual(["b", "c", "d", "a"]);
  });

  it("appends when beforeId is unknown", () => {
    expect(reorderSiblingIds(base, "b", "zzz")).toEqual(["a", "c", "d", "b"]);
  });

  it("dedupes the moved id (no double entry)", () => {
    expect(reorderSiblingIds(base, "b", "d")).toEqual(["a", "c", "b", "d"]);
  });

  it("beforeId === movedId → append (no-op anchor)", () => {
    expect(reorderSiblingIds(base, "b", "b")).toEqual(["a", "c", "d", "b"]);
  });

  it("inserts a brand-new id", () => {
    expect(reorderSiblingIds(["a", "b"], "x", "b")).toEqual(["a", "x", "b"]);
  });
});

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

describe("dropPlacement", () => {
  it("oben davor, unten danach, Mitte unterordnen", () => {
    expect(dropPlacement(0.1, true)).toBe("before");
    expect(dropPlacement(0.39, true)).toBe("before");
    expect(dropPlacement(0.5, true)).toBe("inside");
    expect(dropPlacement(0.61, true)).toBe("after");
  });

  it("ohne Umsortieren bleibt nur Unterordnen", () => {
    expect(dropPlacement(0.1, false)).toBe("inside");
    expect(dropPlacement(0.9, false)).toBe("inside");
  });
});

describe("planDrop", () => {
  interface N {
    id: string;
    children: N[];
  }
  const n = (id: string, children: N[] = []): N => ({ id, children });
  // P ─ A, B, C · Q
  const wald = [n("P", [n("A"), n("B"), n("C")]), n("Q")];

  it("davor und danach unter Geschwistern", () => {
    expect(planDrop(wald, "C", "A", "before")).toEqual({ newParentId: "P", beforeId: "A" });
    expect(planDrop(wald, "C", "A", "after")).toEqual({ newParentId: "P", beforeId: "B" });
  });

  it("hinter den direkten Vorgänger ablegen zeigt nicht auf sich selbst", () => {
    // B hinter A: das nächste Geschwister ausser B ist C.
    expect(planDrop(wald, "B", "A", "after")).toEqual({ newParentId: "P", beforeId: "C" });
  });

  it("hinter das letzte Geschwister = ans Ende", () => {
    expect(planDrop(wald, "A", "C", "after")).toEqual({ newParentId: "P", beforeId: null });
  });

  it("unterordnen und oberste Ebene", () => {
    expect(planDrop(wald, "Q", "B", "inside")).toEqual({ newParentId: "B", beforeId: null });
    expect(planDrop(wald, "A", null, "inside")).toEqual({ newParentId: null, beforeId: null });
    expect(planDrop(wald, "Q", "P", "before")).toEqual({ newParentId: null, beforeId: "P" });
  });

  it("in den eigenen Teilbaum oder auf sich selbst → nichts", () => {
    expect(planDrop(wald, "P", "A", "inside")).toBeNull();
    expect(planDrop(wald, "P", "B", "before")).toBeNull();
    expect(planDrop(wald, "A", "A", "after")).toBeNull();
  });
});
