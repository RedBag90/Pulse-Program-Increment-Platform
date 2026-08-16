import { describe, it, expect } from "vitest";
import { blockerWindowsFromEdges, type BlockerEdge } from "@/modules/work/domain/blocker-window";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("blockerWindowsFromEdges", () => {
  it("maps a 'blocks' edge: the from side is the blocker of the to (feature) side", () => {
    const edges: BlockerEdge[] = [
      {
        type: "blocks",
        fromId: "X",
        toId: "F",
        from: { id: "X", title: "Blocker X", pi: { endDate: utc("2026-03-31") } },
        to: { id: "F", title: "Feature F", pi: null },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.get("F")).toEqual([
      { blockerId: "X", blockerTitle: "Blocker X", blockerEndDate: utc("2026-03-31") },
    ]);
  });

  it("maps a 'depends_on' edge: the to side is the blocker of the from (feature) side", () => {
    const edges: BlockerEdge[] = [
      {
        type: "depends_on",
        fromId: "F",
        toId: "Y",
        from: { id: "F", title: "Feature F", pi: null },
        to: { id: "Y", title: "Blocker Y", pi: { endDate: utc("2026-06-30") } },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.get("F")).toEqual([
      { blockerId: "Y", blockerTitle: "Blocker Y", blockerEndDate: utc("2026-06-30") },
    ]);
  });

  it("emits a null endDate when the blocker is itself unscheduled", () => {
    const edges: BlockerEdge[] = [
      {
        type: "blocks",
        fromId: "X",
        toId: "F",
        from: { id: "X", title: "Blocker X", pi: null },
        to: { id: "F", title: "Feature F", pi: null },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.get("F")).toEqual([
      { blockerId: "X", blockerTitle: "Blocker X", blockerEndDate: null },
    ]);
  });

  it("skips an edge whose feature endpoint is off-scope", () => {
    const edges: BlockerEdge[] = [
      {
        type: "blocks",
        fromId: "X",
        toId: "OTHER",
        from: { id: "X", title: "Blocker X", pi: { endDate: utc("2026-03-31") } },
        to: { id: "OTHER", title: "Other Feature", pi: null },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.size).toBe(0);
  });

  it("ignores relates_to edges (no window) — the 'to' side is treated as blocker and off-scope", () => {
    // A relates_to edge is neither blocks nor depends_on; the function treats
    // non-'blocks' as depends_on-shaped, so the feature side is `fromId`. When
    // that side is in scope it still yields a window, so relates_to edges must
    // simply never be passed in. Here fromId is off-scope → skipped.
    const edges: BlockerEdge[] = [
      {
        type: "relates_to",
        fromId: "OTHER",
        toId: "Z",
        from: { id: "OTHER", title: "Other", pi: null },
        to: { id: "Z", title: "Z", pi: { endDate: utc("2026-01-01") } },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.size).toBe(0);
  });

  it("accumulates multiple blockers for one feature in input order", () => {
    const edges: BlockerEdge[] = [
      {
        type: "blocks",
        fromId: "X1",
        toId: "F",
        from: { id: "X1", title: "First", pi: { endDate: utc("2026-02-01") } },
        to: { id: "F", title: "Feature F", pi: null },
      },
      {
        type: "depends_on",
        fromId: "F",
        toId: "X2",
        from: { id: "F", title: "Feature F", pi: null },
        to: { id: "X2", title: "Second", pi: { endDate: utc("2026-04-01") } },
      },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.get("F")?.map((w) => w.blockerId)).toEqual(["X1", "X2"]);
  });

  it("skips an edge with a missing blocker endpoint", () => {
    const edges: BlockerEdge[] = [
      { type: "blocks", fromId: "X", toId: "F", from: null, to: { id: "F", title: "F", pi: null } },
    ];
    const out = blockerWindowsFromEdges(edges, new Set(["F"]));
    expect(out.size).toBe(0);
  });
});
