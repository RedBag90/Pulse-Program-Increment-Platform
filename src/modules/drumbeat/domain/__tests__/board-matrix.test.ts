import { describe, it, expect } from "vitest";
import {
  buildBoardMatrix,
  normalizePiKey,
  BACKLOG_COLUMN_ID,
  type BoardLane,
  OVERFLOW_COLUMN_ID,
  splitCell,
} from "@/modules/drumbeat/domain/board-matrix";
import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";

const LANES: readonly BoardLane[] = [
  { value: "approved", labelKey: "drumbeat.featureStatus.approved", color: "" },
  { value: "in_progress", labelKey: "drumbeat.featureStatus.inProgress", color: "" },
  { value: "blocked", labelKey: "drumbeat.featureStatus.blocked", color: "" },
  { value: "completed", labelKey: "drumbeat.featureStatus.completed", color: "" },
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
    wsjfJobSize: null,
    wsjfBusinessValue: null,
    wsjfTimeCriticality: null,
    wsjfRiskReduction: null,
    hasBlocker: false,
    blockerHint: null,
    solutionName: null,
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
    plannedJobSize: 0,
    capacity: null,
    jobSizeTarget: null,
    deliveredPerCapacity: null,
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

  it('normalizes null ↔ "" consistently between count and bucketing', () => {
    // A null-PI feature must land in the backlog column AND be counted there —
    // the single normalization owner keeps both in agreement.
    const f = feature("a", null, "in_progress");
    const matrix = buildBoardMatrix([f], pis, LANES);
    expect(matrix.columns[0]!.featureCount).toBe(1);
    expect(matrix.cell(BACKLOG_COLUMN_ID, "in_progress")).toEqual([f]);
  });
});

/**
 * **Kein Feature verschwindet stumm.**
 *
 * Das Board zeigt fünf PIs. Wer links oder rechts davon liegt, hatte vorher
 * keine Zelle — und fiel zwischen `columns` und `features` hindurch: nicht
 * gerendert, nicht gemeldet, aber im Zähler der Toolbar mitgezählt. Wer eine
 * Karte ins übernächste PI schob, sah sie nie wieder.
 */
describe("buildBoardMatrix — die Überlauf-Spalte", () => {
  const lanes = [
    { value: "approved" as const, labelKey: "drumbeat.featureStatus.approved", color: "" },
  ];
  const pi = (id: string): CockpitPiSlot => ({
    id,
    name: id,
    startDate: new Date(0),
    endDate: new Date(0),
    status: "planned",
    featureCount: 0,
    plannedJobSize: 0,
    capacity: null,
    jobSizeTarget: null,
    deliveredPerCapacity: null,
    isCurrent: false,
  });
  const feat = (id: string, piId: string | null): CockpitFeature =>
    ({ id, title: id, status: "approved", piId }) as CockpitFeature;

  it("fängt ein Feature aus einem PI außerhalb des Fensters", () => {
    const m = buildBoardMatrix([feat("a", "q1"), feat("weit-weg", "q9")], [pi("q1")], lanes);
    expect(m.columns.map((c) => c.id)).toEqual(["", "q1", OVERFLOW_COLUMN_ID]);
    expect(m.cell(OVERFLOW_COLUMN_ID, "approved").map((f) => f.id)).toEqual(["weit-weg"]);
  });

  it("zeigt die Spalte nicht, wenn sie niemanden trägt", () => {
    const m = buildBoardMatrix([feat("a", "q1"), feat("b", null)], [pi("q1")], lanes);
    expect(m.columns.map((c) => c.id)).toEqual(["", "q1"]);
  });

  it("zählt Überlauf und Backlog getrennt", () => {
    const m = buildBoardMatrix(
      [feat("a", null), feat("b", "q9"), feat("c", "q9")],
      [pi("q1")],
      lanes,
    );
    expect(m.columns.find((c) => c.id === "")?.featureCount).toBe(1);
    expect(m.columns.find((c) => c.id === OVERFLOW_COLUMN_ID)?.featureCount).toBe(2);
  });

  /** Die Zusicherung, um die es geht: die Summe über alle Zellen ist vollständig. */
  it("verliert kein einziges Feature", () => {
    const features = [feat("a", null), feat("b", "q1"), feat("c", "q8"), feat("d", "q9")];
    const m = buildBoardMatrix(features, [pi("q1")], lanes);
    const gezeigt = m.columns.flatMap((c) => m.cell(c.id, "approved")).map((f) => f.id);
    expect(gezeigt.sort()).toEqual(["a", "b", "c", "d"]);
  });
});

/**
 * **Die Kappung gehört der Bahn, nicht der Fläche.**
 *
 * Eine Zelle trug gemessen bis zu 44 Karten — rund 3800 px Bahnhöhe, während
 * die Nachbarzellen leer waren und dieselbe Höhe mitgingen. Gekappt wird
 * gestaffelt: „Blockiert" und „In Umsetzung" bleiben ganz (Tagesordnung und
 * laufende Arbeit), „Freigegeben" und „Abgeschlossen" sind Haufen.
 */
describe("splitCell", () => {
  const feat = (id: string): CockpitFeature => ({ id, title: id }) as CockpitFeature;
  const zwanzig = Array.from({ length: 20 }, (_, i) => feat(`f${i}`));

  it("ohne Grenze bleibt alles sichtbar", () => {
    const { shown, rest } = splitCell(zwanzig, undefined);
    expect(shown).toHaveLength(20);
    expect(rest).toEqual([]);
  });

  it("mit Grenze zeigt die ersten N und hält den Rest zurück", () => {
    const { shown, rest } = splitCell(zwanzig, 5);
    expect(shown.map((f) => f.id)).toEqual(["f0", "f1", "f2", "f3", "f4"]);
    expect(rest).toHaveLength(15);
  });

  /** Keine „+0 weitere"-Zeile unter einer Zelle, die ohnehin vollständig ist. */
  it("kappt nicht, wenn die Zelle in die Grenze passt", () => {
    const { shown, rest } = splitCell(zwanzig.slice(0, 5), 5);
    expect(shown).toHaveLength(5);
    expect(rest).toEqual([]);
  });

  it("verliert nichts", () => {
    const { shown, rest } = splitCell(zwanzig, 3);
    expect([...shown, ...rest].map((f) => f.id)).toEqual(zwanzig.map((f) => f.id));
  });

  it("kommt mit einer leeren Zelle zurecht", () => {
    expect(splitCell([], 5)).toEqual({ shown: [], rest: [] });
  });
});
