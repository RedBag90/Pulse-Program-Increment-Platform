import { describe, it, expect } from "vitest";
import { buildPbRoundSnapshot } from "@/modules/budgeting/domain/pb-round-snapshot";

const base = {
  cycleKey: "2026-H1",
  status: "closed",
  poolTotal: 1_000_000,
  reserve: 100_000,
  groups: [],
};

describe("buildPbRoundSnapshot", () => {
  it("markiert Konsens-Epics als finanziert (ohne Entscheidung)", () => {
    const snap = buildPbRoundSnapshot({
      ...base,
      zoneEpics: [{ epicId: "e1", title: "A", cost: 200_000, zone: "consensus", yes: 3, total: 3 }],
      decisions: [],
    });
    expect(snap.epics[0]!.funded).toBe(true);
    expect(snap.fundedSum).toBe(200_000);
  });

  it("Streuzone finanziert nur bei Entscheidung funded", () => {
    const snap = buildPbRoundSnapshot({
      ...base,
      zoneEpics: [
        { epicId: "e1", title: "A", cost: 100_000, zone: "spread", yes: 1, total: 3 },
        { epicId: "e2", title: "B", cost: 50_000, zone: "spread", yes: 2, total: 3 },
      ],
      decisions: [{ epicId: "e1", outcome: "funded" }],
    });
    const byId = new Map(snap.epics.map((e) => [e.epicId, e]));
    expect(byId.get("e1")!.funded).toBe(true);
    expect(byId.get("e1")!.outcome).toBe("funded");
    expect(byId.get("e2")!.funded).toBe(false);
    expect(snap.fundedSum).toBe(100_000);
  });

  it("Ablehnungszone ist nie finanziert", () => {
    const snap = buildPbRoundSnapshot({
      ...base,
      zoneEpics: [{ epicId: "e1", title: "A", cost: 100_000, zone: "rejection", yes: 0, total: 3 }],
      decisions: [],
    });
    expect(snap.epics[0]!.funded).toBe(false);
    expect(snap.fundedSum).toBe(0);
  });

  it("reicht Gruppen/Reserve/Topf unverändert durch", () => {
    const groups = [{ name: "G1", spokesperson: "a@x", reportOut: null }];
    const snap = buildPbRoundSnapshot({ ...base, groups, zoneEpics: [], decisions: [] });
    expect(snap.groups).toEqual(groups);
    expect(snap.reserve).toBe(100_000);
    expect(snap.poolTotal).toBe(1_000_000);
  });
});
