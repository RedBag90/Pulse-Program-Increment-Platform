import { describe, it, expect } from "vitest";
import { classifyZones, spreadZone, type GroupVote } from "@/modules/budgeting/domain/three-zone";

// Nordwerk Q4 (aus der PB-Prozessbeschreibung), 3 Gruppen A/B/C.
// Verteilungsergebnis 6.4: E2/E8 = 3/3, E1/E5 = 2/3, E3/E4 = 1/3, E6 = 0/3.
const VOTES: GroupVote[] = [
  { groupId: "A", epicId: "E1", funded: true },
  { groupId: "C", epicId: "E1", funded: true },
  { groupId: "A", epicId: "E2", funded: true },
  { groupId: "B", epicId: "E2", funded: true },
  { groupId: "C", epicId: "E2", funded: true },
  { groupId: "C", epicId: "E3", funded: true },
  { groupId: "B", epicId: "E4", funded: true },
  { groupId: "A", epicId: "E5", funded: true },
  { groupId: "B", epicId: "E5", funded: true },
  { groupId: "A", epicId: "E8", funded: true },
  { groupId: "B", epicId: "E8", funded: true },
  { groupId: "C", epicId: "E8", funded: true },
];
const EPICS = ["E1", "E2", "E3", "E4", "E5", "E6", "E8"];

describe("classifyZones — Nordwerk-Durchlauf", () => {
  const zones = classifyZones(VOTES, EPICS, 3);
  const byId = new Map(zones.map((z) => [z.epicId, z]));

  it("Konsens für E2 und E8 (3/3)", () => {
    expect(byId.get("E2")).toMatchObject({ yes: 3, total: 3, zone: "consensus", majority: "yes" });
    expect(byId.get("E8")).toMatchObject({ yes: 3, total: 3, zone: "consensus", majority: "yes" });
  });

  it("Ablehnung für E6 (0/3)", () => {
    expect(byId.get("E6")).toMatchObject({ yes: 0, total: 3, zone: "rejection", majority: "no" });
  });

  it("Streuzone: E1/E5 mit Ja-Mehrheit (2/3), E3/E4 mit Nein-Mehrheit (1/3)", () => {
    expect(byId.get("E1")).toMatchObject({ yes: 2, zone: "spread", majority: "yes" });
    expect(byId.get("E5")).toMatchObject({ yes: 2, zone: "spread", majority: "yes" });
    expect(byId.get("E3")).toMatchObject({ yes: 1, zone: "spread", majority: "no" });
    expect(byId.get("E4")).toMatchObject({ yes: 1, zone: "spread", majority: "no" });
  });

  it("nur vier Epics stehen zur Diskussion (Streuzone)", () => {
    expect(spreadZone(zones).map((z) => z.epicId).sort()).toEqual(["E1", "E3", "E4", "E5"]);
  });
});

describe("classifyZones — Kanten", () => {
  it("gerade Gruppenzahl mit Gleichstand ⇒ Streuzone ohne Mehrheit (none)", () => {
    const votes: GroupVote[] = [
      { groupId: "A", epicId: "X", funded: true },
      { groupId: "B", epicId: "X", funded: false },
    ];
    expect(classifyZones(votes, ["X"], 2)[0]).toMatchObject({
      yes: 1,
      total: 2,
      zone: "spread",
      majority: "none",
    });
  });

  it("fehlende Stimme zählt als Nein", () => {
    // Nur eine Ja-Stimme erfasst, Gruppenzahl 3 ⇒ yes 1 / total 3.
    expect(classifyZones([{ groupId: "A", epicId: "Y", funded: true }], ["Y"], 3)[0]).toMatchObject({
      yes: 1,
      total: 3,
      zone: "spread",
    });
  });
});
