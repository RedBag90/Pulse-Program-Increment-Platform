import { describe, it, expect } from "vitest";
import {
  buildBoardMatrix,
  normalizePiKey,
  BACKLOG_COLUMN_ID,
  type BoardLane,
} from "@/modules/drumbeat/domain/board-matrix";
import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

const LANES: readonly BoardLane[] = [
  { value: "approved", label: "Bereit", color: "" },
  { value: "in_progress", label: "In Umsetzung", color: "" },
  { value: "blocked", label: "Blockiert", color: "" },
  { value: "completed", label: "Fertig", color: "" },
];

function feature(id: string, piId: string | null, status: FeatureStatus): CockpitFeature {
  return {
    id,
    title: id,
    status,
    piId,
    artId: "art-1",
    artName: "ART 1",
    parentId: null,
    parentTitle: null,
    ownerId: null,
    ownerName: null,
    wsjfComputed: null,
    hasBlocker: false,
    blockerHint: null,
  };
}

function pi(id: string, name: string): CockpitPiSlot {
  return {
    id,
    name,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-03-31"),
    status: "active",
    featureCount: 0,
    isCurrent: false,
  };
}

describe("normalizePiKey", () => {
  it("maps null/undefined to the backlog column id", () => {
    expect(normalizePiKey(null)).toBe(BACKLOG_COLUMN_ID);
    expect(normalizePiKey(undefined)).toBe(BACKLOG_COLUMN_ID);
    expect(BACKLOG_COLUMN_ID).toBe("");
  });

  it("passes a real PI id through unchanged", () => {
    expect(normalizePiKey("pi-1")).toBe("pi-1");
  });
});

describe("buildBoardMatrix", () => {
  const pis = [pi("pi-1", "PI 1"), pi("pi-2", "PI 2")];

  it("prepends the synthetic Backlog column and counts null-PI features", () => {
    const features = [
      feature("a", null, "approved"),
      feature("b", null, "in_progress"),
      feature("c", "pi-1", "approved"),
    ];
    const matrix = buildBoardMatrix(features, pis, LANES);

    expect(matrix.columns.map((c) => c.id)).toEqual([BACKLOG_COLUMN_ID, "pi-1", "pi-2"]);
    const backlog = matrix.columns[0]!;
    expect(backlog.name).toBe("Backlog");
    expect(backlog.featureCount).toBe(2); // a + b
  });

  it("buckets a null-PI feature into the backlog column cell", () => {
    const f = feature("a", null, "approved");
    const matrix = buildBoardMatrix([f], pis, LANES);

    // Same cell whether looked up by "" or by the backlog column id.
    expect(matrix.cell(BACKLOG_COLUMN_ID, "approved")).toEqual([f]);
    expect(matrix.cell("", "approved")).toEqual([f]);
    // It is NOT in any real PI cell.
    expect(matrix.cell("pi-1", "approved")).toEqual([]);
  });

  it("places a feature in its PI × status-lane cell", () => {
    const f = feature("c", "pi-2", "blocked");
    const matrix = buildBoardMatrix([f], pis, LANES);

    expect(matrix.cell("pi-2", "blocked")).toEqual([f]);
    // Wrong lane / wrong column are empty.
    expect(matrix.cell("pi-2", "approved")).toEqual([]);
    expect(matrix.cell("pi-1", "blocked")).toEqual([]);
  });

  it("returns an empty array for cells with no members", () => {
    const matrix = buildBoardMatrix([], pis, LANES);
    expect(matrix.cell("pi-1", "completed")).toEqual([]);
    expect(matrix.cell(BACKLOG_COLUMN_ID, "approved")).toEqual([]);
    expect(matrix.columns[0]!.featureCount).toBe(0);
  });

  it("normalizes null ↔ \"\" consistently between count and bucketing", () => {
    // A null-PI feature must land in the backlog column AND be counted there —
    // the single normalization owner keeps both in agreement.
    const f = feature("a", null, "in_progress");
    const matrix = buildBoardMatrix([f], pis, LANES);
    expect(matrix.columns[0]!.featureCount).toBe(1);
    expect(matrix.cell(BACKLOG_COLUMN_ID, "in_progress")).toEqual([f]);
  });
});
