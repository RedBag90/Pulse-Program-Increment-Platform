import { describe, it, expect } from "vitest";
import { buildIssuesListModel, type IssueRow } from "@/modules/risks/server/views/issues-list";
import { cellKey } from "@/modules/risks/domain/risk-matrix";

function makeIssue(over: Partial<IssueRow> = {}): IssueRow {
  return {
    id: "i1",
    issueNumber: 1,
    title: "An issue",
    description: null,
    probability: "high",
    impact: "high",
    category: "technical",
    reviewStatus: "documented",
    roamStatus: "open",
    roamRationale: null,
    ownerId: null,
    raisedBy: "u1",
    targetResolutionDate: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    parentId: null,
    initiativeId: null,
    assessments: [],
    mitigations: [],
    initiative: null,
    ...over,
  };
}

const prefix = "R-";
const userLabels = { u1: "Alice", u2: "Bob" };

describe("buildIssuesListModel", () => {
  it("computes exposure band from probability×impact", () => {
    const m = buildIssuesListModel({ issues: [makeIssue({ id: "r" })], prefix, userLabels });
    expect(m.rows[0]!.band).toBe("critical"); // high×high → 25 → critical
    expect(m.counts.total).toBe(1);
  });

  it("keeps suggestions out of the register rows", () => {
    const m = buildIssuesListModel({
      issues: [
        makeIssue({ id: "doc", reviewStatus: "documented" }),
        makeIssue({ id: "sug", reviewStatus: "suggested", issueNumber: null }),
      ],
      prefix,
      userLabels,
    });
    expect(m.rows.map((r) => r.id)).toEqual(["doc"]);
    expect(m.suggestions.map((r) => r.id)).toEqual(["sug"]);
  });

  it("collapses children into the head on the matrix (only roots plotted)", () => {
    const m = buildIssuesListModel({
      issues: [
        makeIssue({ id: "head", probability: "high", impact: "high" }),
        makeIssue({ id: "child", parentId: "head", probability: "low", impact: "low" }),
      ],
      prefix,
      userLabels,
    });
    // only the head (parentId==null) is plotted; the child collapses in.
    expect(m.matrix.plots.map((p) => p.issueId)).toEqual(["head"]);
    const critical = m.matrix.cells.find((c) => c.key === cellKey("high", "high"))!;
    expect(critical.count).toBe(1);
    const low = m.matrix.cells.find((c) => c.key === cellKey("low", "low"))!;
    expect(low.count).toBe(0);
  });

  it("attaches a subtree rollup to head rows only", () => {
    const m = buildIssuesListModel({
      issues: [
        makeIssue({ id: "head", roamStatus: "open", initiative: { id: "e1", title: "E1", level: 0, parentId: null } }),
        makeIssue({ id: "c1", parentId: "head", roamStatus: "owned", initiative: { id: "f2", title: "F2", level: 1, parentId: "e2" } }),
      ],
      prefix,
      userLabels,
    });
    const head = m.rows.find((r) => r.id === "head")!;
    const child = m.rows.find((r) => r.id === "c1")!;
    expect(child.rollup).toBeNull();
    expect(head.rollup).not.toBeNull();
    expect(head.rollup!.descendantCount).toBe(1);
    expect(head.rollup!.roamCounts.open).toBe(1);
    expect(head.rollup!.roamCounts.owned).toBe(1);
    // head owns epic e1; child's epic is e2 (its feature's parent) → spans 2
    expect(head.rollup!.spannedEpics).toBe(2);
  });

  it("builds a ROAM funnel + category/owner facets", () => {
    const m = buildIssuesListModel({
      issues: [
        makeIssue({ id: "a", roamStatus: "owned", ownerId: "u1", category: "technical" }),
        makeIssue({ id: "b", roamStatus: "resolved", ownerId: "u2", category: "business" }),
      ],
      prefix,
      userLabels,
    });
    expect(m.roamFunnel.owned).toBe(1);
    expect(m.roamFunnel.resolved).toBe(1);
    expect(m.facets.categories.sort()).toEqual(["business", "technical"]);
    expect(m.facets.owners.map((o) => o.label).sort()).toEqual(["Alice", "Bob"]);
  });
});
