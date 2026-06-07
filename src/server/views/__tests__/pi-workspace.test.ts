import { describe, it, expect } from "vitest";
import {
  buildPiWorkspaceModel,
  computeFeatureBurnup,
  computeObjectiveConfidence,
  type PiWorkspaceInput,
} from "@/server/views/pi-workspace";

const base = (over: Partial<PiWorkspaceInput> = {}): PiWorkspaceInput => ({
  id: "pi1",
  name: "PI 2026-Q1",
  status: "active",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-03-31"),
  artId: null,
  artName: null,
  timelineName: null,
  features: [],
  objectives: [],
  impediments: [],
  now: new Date("2026-02-01"),
  ...over,
});

describe("computeFeatureBurnup", () => {
  it("aggregiert Job-Size mit Anteil completed", () => {
    const b = computeFeatureBurnup([
      { status: "approved", wsjfJobSize: 5 },
      { status: "in_progress", wsjfJobSize: 3 },
      { status: "completed", wsjfJobSize: 2 },
      { status: "completed", wsjfJobSize: 8 },
    ]);
    expect(b.total).toBe(4);
    expect(b.completed).toBe(2);
    expect(b.jobSizeTotal).toBe(18);
    expect(b.jobSizeCompleted).toBe(10);
    expect(b.progress).toBeCloseTo(10 / 18);
  });

  it("liefert progress null bei jobSizeTotal === 0", () => {
    const b = computeFeatureBurnup([
      { status: "approved", wsjfJobSize: null },
      { status: "approved", wsjfJobSize: 0 },
    ]);
    expect(b.progress).toBeNull();
  });

  it("liefert null bei leerer Liste", () => {
    expect(computeFeatureBurnup([]).progress).toBeNull();
  });
});

describe("computeObjectiveConfidence", () => {
  it("mittelt nur ueber committed + voted", () => {
    const c = computeObjectiveConfidence([
      { committed: true, confidence: 4 },
      { committed: true, confidence: 5 },
      { committed: true, confidence: null },
      { committed: false, confidence: 3 }, // ignoriert
    ]);
    expect(c.committed).toBe(3);
    expect(c.voted).toBe(2);
    expect(c.average).toBeCloseTo(4.5);
  });

  it("liefert average null wenn keiner voted hat", () => {
    const c = computeObjectiveConfidence([
      { committed: true, confidence: null },
      { committed: true, confidence: null },
    ]);
    expect(c.average).toBeNull();
  });
});

describe("buildPiWorkspaceModel", () => {
  it("berechnet Days-Remaining gegen `now`", () => {
    const m = buildPiWorkspaceModel(
      base({ endDate: new Date("2026-02-15"), now: new Date("2026-02-01") }),
    );
    expect(m.daysRemaining).toBe(14);
  });

  it("liefert negative daysRemaining nach dem Ende", () => {
    const m = buildPiWorkspaceModel(
      base({ endDate: new Date("2026-01-15"), now: new Date("2026-02-01") }),
    );
    expect(m.daysRemaining).toBe(-17);
  });

  it("zaehlt escalated und unroamed Impediments getrennt", () => {
    const m = buildPiWorkspaceModel(
      base({
        impediments: [
          { status: "escalated", roamStatus: "open" },
          { status: "escalated", roamStatus: "owned" },
          { status: "open", roamStatus: "open" },
          { status: "resolved", roamStatus: "resolved" },
        ],
      }),
    );
    expect(m.impediments.total).toBe(4);
    expect(m.impediments.escalated).toBe(2);
    expect(m.impediments.unroamed).toBe(2);
  });

  it("setzt ART nur, wenn beide Felder gefuellt sind", () => {
    expect(buildPiWorkspaceModel(base({ artId: "a1", artName: "ART 1" })).art).toEqual({
      id: "a1",
      name: "ART 1",
    });
    expect(buildPiWorkspaceModel(base({ artId: "a1", artName: null })).art).toBeNull();
  });
});
