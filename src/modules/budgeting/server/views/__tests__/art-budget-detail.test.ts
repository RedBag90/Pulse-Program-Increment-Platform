import { describe, it, expect } from "vitest";

import { buildArtBudgetDetail } from "@/modules/budgeting/server/views/art-budget-detail";

const NOW = new Date("2026-04-15T00:00:00Z");

const epic = (
  id: string,
  over: Partial<{ stageGate: string; artId: string | null; done: Date | null }> = {},
) => ({
  id,
  title: `Epic ${id}`,
  stageGate: over.stageGate ?? "L4",
  artId: over.artId === undefined ? "art-1" : over.artId,
  implementationCompletedAt: over.done ?? null,
});

const cand = (
  epicId: string,
  amount: number | null,
  cycleKey = "2026-H1",
  over: Partial<{ ask: number; decided: boolean }> = {},
) => ({
  epicId,
  title: `Epic ${epicId}`,
  ask: over.ask ?? amount ?? 0,
  amount,
  cycleKey,
  decided: over.decided ?? true,
});

const base = {
  artId: "art-1",
  now: NOW,
  artNames: { "art-1": "Payments", "art-2": "Cards" },
  withoutArt: { count: 0, amount: 0 },
};

describe("buildArtBudgetDetail", () => {
  it("zeigt die Halbjahre mit Zuteilung, neueste zuerst", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [cand("a", 100, "2025-H2"), cand("b", 200, "2026-H1")],
      epics: [epic("a"), epic("b")],
    });
    expect(d.cycles.map((c) => c.key)).toEqual(["2026-H1", "2025-H2"]);
    expect(d.cycleKey).toBe("2026-H1");
  });

  it("rechnet nur das gewählte Halbjahr", () => {
    const d = buildArtBudgetDetail({
      ...base,
      cycleKey: "2025-H2",
      candidates: [cand("a", 100, "2025-H2"), cand("b", 200, "2026-H1")],
      epics: [epic("a"), epic("b")],
    });
    expect(d.cycleKey).toBe("2025-H2");
    expect(d.sources[0]!.breakdown.total).toBe(100);
  });

  // Ohne Zuteilung zeigt die Fläche das laufende Halbjahr, nicht eine leere Auswahl.
  it("fällt ohne jede Zuteilung auf das laufende Halbjahr zurück", () => {
    const d = buildArtBudgetDetail({ ...base, candidates: [], epics: [] });
    expect(d.cycles).toEqual([{ key: "2026-H1", label: "H1 2026" }]);
    expect(d.sources[0]!.breakdown.total).toBe(0);
  });

  it("ignoriert ein unbekanntes Halbjahr aus der URL", () => {
    const d = buildArtBudgetDetail({
      ...base,
      cycleKey: "1999-H1",
      candidates: [cand("a", 100, "2026-H1")],
      epics: [epic("a")],
    });
    expect(d.cycleKey).toBe("2026-H1");
  });

  it("staffelt nach Zustand und trägt die Titel bei", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [
        cand("offen", 600, "2026-H1"),
        cand("laeuft", 500, "2026-H1"),
        cand("fertig", 450, "2026-H1"),
      ],
      epics: [
        epic("offen", { stageGate: "L3" }),
        epic("laeuft", { stageGate: "L4" }),
        epic("fertig", { stageGate: "L5" }),
      ],
    });
    const s = d.sources[0]!;
    expect(s.source).toBe("portfolio");
    expect(s.breakdown.byState).toEqual({ notStarted: 600, committed: 500, consumed: 450 });
    expect(s.titles["offen"]).toBe("Epic offen");
  });

  // Der ART der Kachel ist eingefroren — das Budget bleibt hier, der Wechsel wird benannt.
  it("weist ein Epic aus, das inzwischen einem anderen ART gehört", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [cand("gewandert", 200, "2026-H1")],
      epics: [epic("gewandert", { artId: "art-2" })],
    });
    expect(d.switchedArt).toEqual([
      { epicId: "gewandert", title: "Epic gewandert", currentArtName: "Cards" },
    ]);
    // Das Geld zählt weiterhin hier.
    expect(d.sources[0]!.breakdown.total).toBe(200);
  });

  it("lässt ein gelöschtes Epic aus der Staffel heraus", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [cand("da", 300, "2026-H1"), cand("geloescht", 700, "2026-H1")],
      epics: [epic("da")],
    });
    expect(d.sources[0]!.breakdown.total).toBe(300);
  });

  // „Nicht finanziert" heißt: die Kachel hat entschieden und nichts gegeben.
  // Eine noch offene Kachel hat schlicht noch nicht entschieden.
  it("führt nur entschiedene Kacheln als nicht finanziert", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [
        cand("leer-ausgegangen", null, "2026-H1", { ask: 700, decided: true }),
        cand("noch-offen", null, "2026-H1", { ask: 300, decided: false }),
        cand("null-bekommen", 0, "2026-H1", { ask: 500, decided: true }),
      ],
      epics: [epic("leer-ausgegangen"), epic("noch-offen"), epic("null-bekommen")],
    });

    expect(d.unfunded.map((u) => u.epicId)).toEqual(["leer-ausgegangen", "null-bekommen"]);
    expect(d.unfunded[0]!.ask).toBe(700);
    expect(d.unfunded.every((u) => u.reason === "ballot")).toBe(true);
  });

  it("sortiert die nicht finanzierten nach Anfrage, größte zuerst", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [
        cand("klein", null, "2026-H1", { ask: 100 }),
        cand("gross", null, "2026-H1", { ask: 900 }),
      ],
      epics: [epic("klein"), epic("gross")],
    });
    expect(d.unfunded.map((u) => u.epicId)).toEqual(["gross", "klein"]);
  });

  // Der Antrag hat stattgefunden, auch wenn das Epic später verschwand.
  it("behält den Kandidaten-Titel, wenn das Epic gelöscht ist", () => {
    const d = buildArtBudgetDetail({
      ...base,
      candidates: [cand("weg", null, "2026-H1", { ask: 400 })],
      epics: [],
    });
    expect(d.unfunded).toEqual([
      { epicId: "weg", title: "Epic weg", stageGate: null, ask: 400, reason: "ballot" },
    ]);
  });

  it("reicht die Zuteilungen an Epics ohne ART durch", () => {
    const d = buildArtBudgetDetail({
      ...base,
      withoutArt: { count: 2, amount: 200_000 },
      candidates: [],
      epics: [],
    });
    expect(d.epicsWithoutArt).toEqual({ count: 2, amount: 200_000 });
  });
});
