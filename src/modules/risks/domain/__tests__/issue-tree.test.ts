import { describe, it, expect } from "vitest";
import { buildIssueTree, wouldCreateCycle } from "@/modules/risks/domain/issue-tree";

interface Row {
  id: string;
  parentId: string | null;
}
const r = (id: string, parentId: string | null): Row => ({ id, parentId });

describe("buildIssueTree", () => {
  it("nests children under heads and preserves sibling order", () => {
    const tree = buildIssueTree([r("h", null), r("a", "h"), r("b", "h"), r("x", null)]);
    expect(tree.map((t) => t.row.id)).toEqual(["h", "x"]);
    expect(tree[0]!.children.map((c) => c.row.id)).toEqual(["a", "b"]);
    expect(tree[0]!.children[0]!.depth).toBe(1);
  });

  it("nests deeper (grandchildren)", () => {
    const tree = buildIssueTree([r("h", null), r("a", "h"), r("g", "a")]);
    expect(tree[0]!.children[0]!.children[0]!.row.id).toBe("g");
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it("promotes orphans (parent not in set) to root", () => {
    const tree = buildIssueTree([r("child", "missing-head")]);
    expect(tree.map((t) => t.row.id)).toEqual(["child"]);
    expect(tree[0]!.depth).toBe(0);
  });

  it("is cycle-safe", () => {
    const tree = buildIssueTree([r("a", "b"), r("b", "a")]);
    // both appear exactly once across the forest
    const ids: string[] = [];
    const walk = (ns: ReturnType<typeof buildIssueTree<Row>>) =>
      ns.forEach((node) => {
        ids.push(node.row.id);
        walk(node.children);
      });
    walk(tree);
    expect(ids.sort()).toEqual(["a", "b"]);
  });
});

describe("wouldCreateCycle", () => {
  const parentOf = new Map<string, string | null>([
    ["h", null],
    ["a", "h"],
    ["g", "a"],
  ]);
  it("rejects nesting under self", () => {
    expect(wouldCreateCycle("a", "a", parentOf)).toBe(true);
  });
  it("rejects nesting under a descendant", () => {
    expect(wouldCreateCycle("h", "g", parentOf)).toBe(true); // g is a descendant of h
  });
  it("allows a valid move", () => {
    expect(wouldCreateCycle("g", "h", parentOf)).toBe(false);
  });
  it("allows moving to root (null)", () => {
    expect(wouldCreateCycle("g", null, parentOf)).toBe(false);
  });
});
