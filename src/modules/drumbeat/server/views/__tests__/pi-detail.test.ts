import { describe, it, expect } from "vitest";
import {
  buildPiDetailModel,
  type PiDetailInputs,
  type PiDetailCandidateRow,
  type PiDetailFeatureRow,
} from "@/modules/drumbeat/server/views/pi-detail";

const today = new Date("2026-06-01T00:00:00Z");
const later = new Date("2026-09-30T00:00:00Z");

function baseInputs(): PiDetailInputs {
  return {
    pi: {
      id: "pi1",
      name: "PI 2026.2",
      status: "planned",
      startDate: today,
      endDate: later,
      timeline: {
        id: "tl1",
        name: "Standard 8 Wochen",
        arts: [
          { id: "a1", name: "Mobile Banking ART" },
          { id: "a2", name: "Event Mgmt Orga ART" },
        ],
      },
      initiatives: [],
    },
    impediments: [],
    candidates: [],
  };
}

describe("buildPiDetailModel", () => {
  it("returns null when Timeline has no subscribed ARTs", () => {
    const inputs = baseInputs();
    inputs.pi.timeline = { id: "tl", name: "Empty", arts: [] };
    expect(buildPiDetailModel(inputs)).toBeNull();
  });

  it("returns null when PI has no Timeline", () => {
    const inputs = baseInputs();
    inputs.pi.timeline = null;
    expect(buildPiDetailModel(inputs)).toBeNull();
  });

  it("primaryArt is the first subscribed ART", () => {
    const m = buildPiDetailModel(baseInputs())!;
    expect(m.primaryArt.id).toBe("a1");
    expect(m.arts.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("groups Features by ART and coerces wsjfComputed", () => {
    const inputs = baseInputs();
    inputs.pi.initiatives = [
      { id: "f1", title: "F1", status: "approved", wsjfComputed: 3.5, artId: "a1" },
      { id: "f2", title: "F2", status: "approved", wsjfComputed: "1.5", artId: "a2" },
      { id: "f3", title: "F3", status: "approved", wsjfComputed: null, artId: "a1" },
      // Edge case: orphan Feature without artId — skipped.
      { id: "f4", title: "F4", status: "approved", wsjfComputed: 9, artId: null },
    ] as PiDetailFeatureRow[];
    const m = buildPiDetailModel(inputs)!;
    expect(m.featuresByArt.get("a1")?.map((f) => f.id)).toEqual(["f1", "f3"]);
    expect(m.featuresByArt.get("a2")?.map((f) => f.id)).toEqual(["f2"]);
    expect(m.featuresByArt.get("a1")?.[0]?.wsjfComputed).toBe(3.5);
    expect(m.featuresByArt.get("a2")?.[0]?.wsjfComputed).toBe(1.5);
    expect(m.featuresByArt.get("a1")?.[1]?.wsjfComputed).toBeNull();
  });

  it("groups Candidates by ART and carries currentPiName", () => {
    const inputs = baseInputs();
    inputs.candidates = [
      { id: "c1", title: "C1", wsjfComputed: 7, artId: "a1", pi: { name: "PI 2026.1" } },
      { id: "c2", title: "C2", wsjfComputed: 4, artId: "a1", pi: null },
      { id: "c3", title: "C3", wsjfComputed: null, artId: "a2", pi: null },
      // Orphan skipped.
      { id: "c4", title: "C4", wsjfComputed: 9, artId: null, pi: null },
    ] as PiDetailCandidateRow[];
    const m = buildPiDetailModel(inputs)!;
    expect(m.candidatesByArt.get("a1")?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(m.candidatesByArt.get("a1")?.[0]?.currentPiName).toBe("PI 2026.1");
    expect(m.candidatesByArt.get("a1")?.[1]?.currentPiName).toBeNull();
    expect(m.candidatesByArt.get("a2")?.[0]?.wsjfComputed).toBeNull();
  });

  it("summary delegates to summarizePiOverview (smoke check)", () => {
    const m = buildPiDetailModel(baseInputs())!;
    expect(m.summary).toBeDefined();
    // No assertion on values — that contract lives in the domain read-model.
  });
});
