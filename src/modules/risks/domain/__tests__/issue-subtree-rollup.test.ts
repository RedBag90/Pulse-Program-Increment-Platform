import { describe, it, expect } from "vitest";
import { rollupIssueSubtrees, type RollupNode } from "@/modules/risks/domain/issue-subtree-rollup";

function n(id: string, parentId: string | null, roam: string, epicId: string | null): RollupNode {
  return { id, parentId, roamStatus: roam, epicId };
}

describe("rollupIssueSubtrees", () => {
  it("aggregates a leaf's own ROAM + epic", () => {
    const r = rollupIssueSubtrees([n("a", null, "owned", "e1")]).get("a")!;
    expect(r.roamCounts.owned).toBe(1);
    expect(r.spannedEpicIds).toEqual(["e1"]);
    expect(r.descendantCount).toBe(0);
  });

  it("folds descendants (ROAM distribution, spanned epics, count) into the head", () => {
    const map = rollupIssueSubtrees([
      n("head", null, "open", "e1"),
      n("c1", "head", "owned", "e2"),
      n("c2", "head", "resolved", "e1"),
      n("g1", "c1", "owned", "e3"), // grandchild
    ]);
    const head = map.get("head")!;
    expect(head.descendantCount).toBe(3);
    expect(head.roamCounts.open).toBe(1);
    expect(head.roamCounts.owned).toBe(2);
    expect(head.roamCounts.resolved).toBe(1);
    expect(head.spannedEpicIds.sort()).toEqual(["e1", "e2", "e3"]);
    // c1 rolls up itself + g1
    expect(map.get("c1")!.descendantCount).toBe(1);
  });

  it("does not loop on a parent cycle", () => {
    const map = rollupIssueSubtrees([n("a", "b", "open", null), n("b", "a", "owned", null)]);
    expect(map.has("a")).toBe(true);
    expect(map.has("b")).toBe(true);
  });
});
