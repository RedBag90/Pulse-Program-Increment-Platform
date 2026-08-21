import { describe, it, expect } from "vitest";
import { swimlaneLayout } from "@/modules/drumbeat/domain/graph-layout";

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
