import { describe, it, expect } from "vitest";
import {
  rankLayout,
  swimlaneLayout,
  type RankEdge,
  type RankNode,
} from "@/modules/drumbeat/domain/graph-layout";

// Compact SVG geometry (mirrors graph-layout internals):
//   colX = col * (160 + 80) + 20  → 20, 260, 500, …
//   rowY = row * (44 + 20)  + 20  → 20, 84, 148, …
const colX = (col: number) => col * 240 + 20;
const rowY = (row: number) => row * 64 + 20;

function nodes(...ids: string[]): RankNode[] {
  return ids.map((id) => ({ id }));
}

describe("rankLayout", () => {
  it("returns an empty layout for no nodes", () => {
    const out = rankLayout([], []);
    expect(out.width).toBe(0);
    expect(out.height).toBe(0);
    expect(out.positions.size).toBe(0);
  });

  it("ranks a linear chain into consecutive columns", () => {
    const edges: RankEdge[] = [
      { fromId: "a", toId: "b", type: "blocks" },
      { fromId: "b", toId: "c", type: "depends_on" },
    ];
    const { positions } = rankLayout(nodes("a", "b", "c"), edges);
    expect(positions.get("a")).toEqual({ x: colX(0), y: rowY(0) });
    expect(positions.get("b")).toEqual({ x: colX(1), y: rowY(0) });
    expect(positions.get("c")).toEqual({ x: colX(2), y: rowY(0) });
  });

  it("stacks parallel successors in the same column", () => {
    const edges: RankEdge[] = [
      { fromId: "a", toId: "b", type: "blocks" },
      { fromId: "a", toId: "c", type: "blocks" },
    ];
    const { positions } = rankLayout(nodes("a", "b", "c"), edges);
    expect(positions.get("a")).toEqual({ x: colX(0), y: rowY(0) });
    // b and c share rank 1 → same column, stacked rows.
    expect(positions.get("b")).toEqual({ x: colX(1), y: rowY(0) });
    expect(positions.get("c")).toEqual({ x: colX(1), y: rowY(1) });
  });

  it("excludes relates_to edges from ranking (both stay at rank 0)", () => {
    const edges: RankEdge[] = [{ fromId: "a", toId: "b", type: "relates_to" }];
    const { positions } = rankLayout(nodes("a", "b"), edges);
    // No directed edge → both are sources at column 0, stacked.
    expect(positions.get("a")).toEqual({ x: colX(0), y: rowY(0) });
    expect(positions.get("b")).toEqual({ x: colX(0), y: rowY(1) });
  });
});

describe("swimlaneLayout", () => {
  const pis = [
    { id: "pi1", name: "PI 1", startDate: "2026-01-01" },
    { id: "pi2", name: "PI 2", startDate: "2026-04-01" },
  ];
  // COL_WIDTH = 220 + 160 = 380 ; FIRST_ROW_Y = 56 ; row step = 96 + 60 = 156
  const colWidth = 380;
  const laneY = (idx: number) => 56 + idx * 156;

  const { headers, features, ghosts } = swimlaneLayout(
    [
      { id: "f1", piId: null }, // Backlog (col 0)
      { id: "f2", piId: "pi1" }, // col 1
      { id: "f3", piId: "pi2" }, // col 2
      { id: "f4", piId: "unknown" }, // unknown PI → Backlog fallback
    ],
    [{ id: "g1" }],
    pis,
  );

  it("emits one header per column: Backlog, PIs, Cross-Epic", () => {
    expect(headers.map((h) => h.label)).toEqual(["Backlog", "PI 1", "PI 2", "Cross-Epic"]);
    expect(headers.map((h) => h.x)).toEqual([0, colWidth, colWidth * 2, colWidth * 3]);
    expect(headers.every((h) => h.y === 0)).toBe(true);
  });

  it("buckets features into PI columns (unknown PI falls back to Backlog)", () => {
    const byId = new Map(features.map((f) => [f.id, f]));
    // Backlog column (0): f1 stacked above f4.
    expect(byId.get("f1")).toEqual({ id: "f1", x: 0, y: laneY(0) });
    expect(byId.get("f4")).toEqual({ id: "f4", x: 0, y: laneY(1) });
    // PI columns.
    expect(byId.get("f2")).toEqual({ id: "f2", x: colWidth, y: laneY(0) });
    expect(byId.get("f3")).toEqual({ id: "f3", x: colWidth * 2, y: laneY(0) });
  });

  it("places ghost nodes in the rightmost Cross-Epic column", () => {
    expect(ghosts).toEqual([{ id: "g1", x: colWidth * 3, y: laneY(0) }]);
  });
});
