import { describe, it, expect } from "vitest";

import {
  allocationState,
  summarizeAllocations,
  allocationShare,
  type AllocatedEpic,
} from "@/modules/budgeting/domain/allocation-state";

const epic = (over: Partial<AllocatedEpic> = {}): AllocatedEpic => ({
  epicId: "e",
  amount: 100,
  stageGate: "L2",
  implementationCompletedAt: null,
  ...over,
});

describe("allocationState", () => {
  it.each([
    ["L0", "notStarted"],
    ["L1", "notStarted"],
    ["L2", "notStarted"],
    ["L3", "notStarted"],
    ["L4", "committed"],
    ["L5", "consumed"],
  ])("Reifegrad %s → %s", (stageGate, expected) => {
    expect(allocationState({ stageGate, implementationCompletedAt: null })).toBe(expected);
  });

  // Die Spalte bleibt auf "L4" stehen, während der Stempel schon L4.2 bedeutet.
  // Wer nur auf stageGate schaut, zählt gelieferte Arbeit als laufend.
  it("L4 mit gesetztem implementationCompletedAt zählt als verbraucht", () => {
    expect(
      allocationState({ stageGate: "L4", implementationCompletedAt: new Date("2026-03-01") }),
    ).toBe("consumed");
  });

  it("der Stempel gewinnt auch vor einem niedrigeren Reifegrad", () => {
    expect(
      allocationState({ stageGate: "L3", implementationCompletedAt: new Date("2026-03-01") }),
    ).toBe("consumed");
  });
});

describe("summarizeAllocations", () => {
  it("staffelt die Summe und lässt die drei Zustände auf das Ganze aufgehen", () => {
    const b = summarizeAllocations([
      epic({ epicId: "a", amount: 600, stageGate: "L3" }),
      epic({ epicId: "b", amount: 500, stageGate: "L4" }),
      epic({ epicId: "c", amount: 400, stageGate: "L4" }),
      epic({ epicId: "d", amount: 450, stageGate: "L5" }),
      epic({ epicId: "e", amount: 250, stageGate: "L4", implementationCompletedAt: new Date() }),
    ]);

    expect(b.total).toBe(2200);
    expect(b.byState).toEqual({ notStarted: 600, committed: 900, consumed: 700 });
    expect(b.countByState).toEqual({ notStarted: 1, committed: 2, consumed: 2 });
    expect(b.byState.notStarted + b.byState.committed + b.byState.consumed).toBe(b.total);
  });

  it("stellt das Unerledigte nach oben, innerhalb eines Zustands den größten Betrag", () => {
    const b = summarizeAllocations([
      epic({ epicId: "fertig", amount: 900, stageGate: "L5" }),
      epic({ epicId: "klein-offen", amount: 100, stageGate: "L1" }),
      epic({ epicId: "gross-offen", amount: 800, stageGate: "L1" }),
      epic({ epicId: "laeuft", amount: 500, stageGate: "L4" }),
    ]);

    expect(b.rows.map((r) => r.epicId)).toEqual(["gross-offen", "klein-offen", "laeuft", "fertig"]);
  });

  // Die Zyklus-Karte schreibt auch 0-Zellen; eine Liste voller Nullzeilen sagt nichts.
  it("lässt Epics ohne Zuteilung heraus, statt sie mit 0 zu führen", () => {
    const b = summarizeAllocations([
      epic({ epicId: "mit", amount: 300, stageGate: "L4" }),
      epic({ epicId: "ohne", amount: 0, stageGate: "L4" }),
    ]);

    expect(b.rows.map((r) => r.epicId)).toEqual(["mit"]);
    expect(b.countByState.committed).toBe(1);
    expect(b.total).toBe(300);
  });

  it("leere Eingabe ergibt eine leere Staffel, keine Ausnahme", () => {
    const b = summarizeAllocations([]);
    expect(b.total).toBe(0);
    expect(b.rows).toEqual([]);
    expect(b.byState).toEqual({ notStarted: 0, committed: 0, consumed: 0 });
  });
});

describe("allocationShare", () => {
  it("rechnet den Anteil in Prozent", () => {
    const b = summarizeAllocations([
      epic({ epicId: "a", amount: 700, stageGate: "L5" }),
      epic({ epicId: "b", amount: 1100, stageGate: "L4" }),
      epic({ epicId: "c", amount: 600, stageGate: "L2" }),
    ]);

    expect(allocationShare(b, "consumed")).toBe(29);
    expect(allocationShare(b, "committed")).toBe(46);
    expect(allocationShare(b, "notStarted")).toBe(25);
  });

  it("ohne Zuteilung 0 statt Division durch null", () => {
    expect(allocationShare(summarizeAllocations([]), "consumed")).toBe(0);
  });
});
