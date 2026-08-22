import { describe, it, expect } from "vitest";
import { buildZonesModel } from "@/modules/budgeting/server/views/zones-view";

const BALLOT = [
  { id: "E1", title: "Kundenportal", cost: 600_000 },
  { id: "E2", title: "Abrechnungsmigration", cost: 800_000 },
  { id: "E3", title: "Mobile App", cost: 400_000 },
  { id: "E4", title: "Data Warehouse", cost: 700_000 },
  { id: "E5", title: "Rechnungsprüfung", cost: 300_000 },
  { id: "E6", title: "Marktplatz", cost: 500_000 },
  { id: "E8", title: "Recruiting", cost: 200_000 },
];

const V = (groupId: string, epicId: string) => ({ groupId, epicId, funded: true });
const VOTES = [
  V("A", "E1"), V("C", "E1"),
  V("A", "E2"), V("B", "E2"), V("C", "E2"),
  V("C", "E3"),
  V("B", "E4"),
  V("A", "E5"), V("B", "E5"),
  V("A", "E8"), V("B", "E8"), V("C", "E8"),
];

describe("buildZonesModel — Nordwerk", () => {
  const m = buildZonesModel({
    roundId: "r1",
    status: "running",
    groups: [
      { id: "A", name: "A" },
      { id: "B", name: "B" },
      { id: "C", name: "C" },
    ],
    ballot: BALLOT,
    votes: VOTES,
    distributable: 2_050_000,
  });
  const byId = new Map(m.epics.map((e) => [e.epicId, e]));

  it("Zonen stimmen mit dem Beispiel überein", () => {
    expect(byId.get("E2")!.zone).toBe("consensus");
    expect(byId.get("E8")!.zone).toBe("consensus");
    expect(byId.get("E6")!.zone).toBe("rejection");
    expect(["E1", "E3", "E4", "E5"].map((id) => byId.get(id)!.zone)).toEqual([
      "spread",
      "spread",
      "spread",
      "spread",
    ]);
  });

  it("Zonen-Volumina", () => {
    expect(m.consensusSum).toBe(1_000_000); // E2 800k + E8 200k
    expect(m.spreadSum).toBe(2_000_000); // E1 600 + E5 300 + E3 400 + E4 700
    expect(m.rejectionCount).toBe(1);
  });

  it("Knappheitsfaktor ≈ 1,71 und besteht das Tor", () => {
    expect(m.scarcity.demand).toBe(3_500_000);
    expect(m.scarcity.factor).toBeCloseTo(1.71, 2);
    expect(m.scarcity.passes).toBe(true);
  });

  it("Stimmen-Lookup für die Erfassungs-Matrix", () => {
    expect(m.votes["A:E1"]).toBe(true);
    expect(m.votes["B:E1"]).toBeUndefined();
  });
});
