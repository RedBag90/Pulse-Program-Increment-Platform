import { describe, it, expect } from "vitest";
import { loadFundingPhases } from "@/modules/budgeting/server/views/art-funding";
import { budgetingStore, type Rows } from "@/test/fakes/budgeting-store";

/**
 * Der erste der zwölf Loader in `server/views/`, die bis hierhin keinen Test
 * hatten.
 *
 * Die Regel dahinter (`artFundingPhases`) ist mit 119 Zeilen geprüft — das
 * **Zusammensammeln der Fakten** aus sechs Abfragen mit null. Genau in dieser
 * Hälfte saßen alle drei Fehler dieser Sitzung. Der Speicher wertet `where`
 * aus, also prüft dieser Test Verhalten: welchen Schritt zeigt die Leiste, wenn
 * die Welt so und so aussieht.
 */

const VS = "vs-1";
const A1 = "art-1";
const A2 = "art-2";
const CYCLE = "2026-H2";

/** Die Welt in ihren Stufen — jede Stufe legt eine Zeile mehr. */
function world(stage: "leer" | "budget" | "kachel" | "zuspruch" | "aufgeteilt" | "verteilt"): Rows {
  const rows: Rows = {
    art: [
      { id: A1, tenantId: "T", valueStreamId: VS },
      { id: A2, tenantId: "T", valueStreamId: VS },
    ],
  };
  if (stage === "leer") return rows;

  rows.runTheBusinessItem = [
    { id: "p1", tenantId: "T", valueStreamId: VS, artId: A1, kind: "art_change", active: true },
  ];
  if (stage === "budget") return rows;

  rows.budgetRound = [{ id: "r1", tenantId: "T", cycleKey: CYCLE, status: "running" }];
  rows.budgetCandidate = [
    { id: "c1", tenantId: "T", kind: "rtb", valueStreamId: VS, roundId: "r1", finalAmount: null },
  ];
  if (stage === "kachel") return rows;

  rows.budgetCandidate = [
    {
      id: "c1",
      tenantId: "T",
      kind: "rtb",
      valueStreamId: VS,
      roundId: "r1",
      finalAmount: 300_000,
    },
  ];
  if (stage === "zuspruch") return rows;

  rows.rtbItemAward = [
    { id: "w1", tenantId: "T", rtbItemId: "p1", cycleKey: CYCLE, amount: 300_000 },
  ];
  if (stage === "aufgeteilt") return rows;

  rows.artEpicAllocation = [
    { id: "a1", tenantId: "T", artId: A1, cycleKey: CYCLE, amount: 300_000 },
  ];
  return rows;
}

async function stepsOf(
  stage: Parameters<typeof world>[0],
  focusArtId?: string,
): Promise<{ key: string; state: string }[]> {
  const store = budgetingStore(world(stage));
  const phases = await loadFundingPhases(store.db, "T" as never, VS, CYCLE, focusArtId);
  return phases.map((p) => ({ key: p.key, state: p.state }));
}

/** Welcher Schritt ist gerade dran? */
const current = (steps: { key: string; state: string }[]) =>
  steps.find((s) => s.state === "current")?.key;

describe("loadFundingPhases — die Fakten hinter der Leiste", () => {
  it("beginnt beim Budget, wenn es keine Position gibt", async () => {
    expect(current(await stepsOf("leer"))).toBe("budget");
  });

  it("wartet auf die Kachel, sobald ein Budget beantragt ist", async () => {
    const steps = await stepsOf("budget");
    expect(steps[0]?.state).toBe("done");
    // Ohne Kachel ist der nächste Schritt gesperrt, nicht „dran".
    expect(steps[1]?.state).toBe("blocked");
  });

  it("erkennt die PB-Liste an einem Kandidaten der Kachel", async () => {
    const steps = await stepsOf("kachel");
    expect(steps[1]?.state).toBe("done");
    expect(current(steps)).toBe("award");
  });

  it("erkennt den Zuspruch am finalen Betrag", async () => {
    expect(current(await stepsOf("zuspruch"))).toBe("split");
  });

  it("erkennt das Aufteilen am Award — dann ist der ART dran", async () => {
    expect(current(await stepsOf("aufgeteilt"))).toBe("distribute");
  });

  it("ist fertig, wenn das Budget verteilt ist", async () => {
    const steps = await stepsOf("verteilt", A1);
    expect(steps.every((s) => s.state === "done")).toBe(true);
  });

  it("zählt auf der Wertstrom-Sicht nur ARTs mit Budget", async () => {
    // A2 hat keine Position, zählt also nicht in „x von y".
    const store = budgetingStore(world("aufgeteilt"));
    const phases = await loadFundingPhases(store.db, "T" as never, VS, CYCLE);
    expect(phases[4]?.detail).toBe("0 von 1");
  });

  it("nennt die fehlende Kachel als Grund, nicht das fehlende Budget", async () => {
    const store = budgetingStore(world("budget"));
    const phases = await loadFundingPhases(store.db, "T" as never, VS, CYCLE);
    expect(phases[1]?.blockedBy).toContain("keine Kachel");
  });
});
