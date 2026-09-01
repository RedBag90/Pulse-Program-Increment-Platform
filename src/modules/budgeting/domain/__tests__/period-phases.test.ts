import { describe, it, expect } from "vitest";
import {
  periodPhases,
  phaseSummary,
  currentPhase,
  type PeriodPhaseFacts,
} from "@/modules/budgeting/domain/period-phases";

/**
 * Die Leiste, die diese Funktion speist, ersetzt eine, deren sechs Schritte
 * einen Ablauf beschrieben, den es nicht mehr gab, und deren Links alle auf
 * Redirects zeigten. Entsprechend prüfen die Fälle hier vor allem: leitet sich
 * jeder Zustand wirklich aus **dieser** Kachel ab?
 */
const facts = (over: Partial<PeriodPhaseFacts> = {}): PeriodPhaseFacts => ({
  status: "draft",
  poolTotal: 0,
  hasTimeframe: false,
  candidateCount: 0,
  staffedGroupCount: 0,
  groupCount: 0,
  submittedCount: 0,
  hasRevision: false,
  ...over,
});

const state = (f: PeriodPhaseFacts) =>
  Object.fromEntries(periodPhases(f).map((p) => [p.key, p.state]));

describe("periodPhases", () => {
  it("eine frische Kachel steht auf Phase 1, der Rest wartet oder ist gesperrt", () => {
    expect(state(facts())).toEqual({
      rahmen: "current",
      ballot: "open",
      gruppen: "open",
      start: "blocked",
      verteilen: "blocked",
      finalisieren: "blocked",
      protokoll: "blocked",
    });
  });

  it("`current` ist immer die erste offene Phase — genau eine", () => {
    const phases = periodPhases(facts({ poolTotal: 2_000_000, hasTimeframe: true }));
    expect(phases.filter((p) => p.state === "current")).toHaveLength(1);
    expect(currentPhase(phases)?.key).toBe("ballot");
  });

  it("der Rahmen zählt erst mit Topf **und** Zeitraum", () => {
    expect(state(facts({ poolTotal: 2_000_000 })).rahmen).toBe("current");
    expect(state(facts({ hasTimeframe: true })).rahmen).toBe("current");
    expect(state(facts({ poolTotal: 2_000_000, hasTimeframe: true })).rahmen).toBe("done");
  });

  it("eine Gruppe ohne Mitglieder zählt nicht", () => {
    const ready = facts({ poolTotal: 1, hasTimeframe: true, candidateCount: 1, groupCount: 2 });
    expect(state(ready).gruppen).toBe("current");
    expect(state({ ...ready, staffedGroupCount: 1 }).gruppen).toBe("done");
  });

  it("der Start ist gesperrt, bis Ballot und Gruppen stehen", () => {
    // Die Leiste sagt damit dasselbe wie der Knopf in der Setup-Checkliste —
    // und trägt dieselbe Nummer.
    const p = (f: PeriodPhaseFacts) => periodPhases(f).find((x) => x.key === "start")!;

    const leer = p(facts({ poolTotal: 1, hasTimeframe: true }));
    expect(leer.state).toBe("blocked");
    expect(leer.blockedBy).toContain("besetzten Gruppe");

    const bereit = p(
      facts({ poolTotal: 1, hasTimeframe: true, candidateCount: 2, staffedGroupCount: 1 }),
    );
    expect(bereit.state).toBe("current");
    expect(bereit.blockedBy).toBeUndefined();

    expect(p(facts({ status: "running" })).state).toBe("done");
  });

  it("der Start liegt im Setup-Reiter, nicht in der Verteilung", () => {
    expect(periodPhases(facts()).find((x) => x.key === "start")!.tab).toBe("setup");
  });

  it("Verteilen ist gesperrt, solange die Runde nicht läuft — mit Begründung", () => {
    const before = periodPhases(facts()).find((p) => p.key === "verteilen")!;
    expect(before.state).toBe("blocked");
    expect(before.blockedBy).toContain("nicht gestartet");

    const running = periodPhases(facts({ status: "running", groupCount: 3 })).find(
      (p) => p.key === "verteilen",
    )!;
    expect(running.state).toBe("current");
    expect(running.blockedBy).toBeUndefined();
  });

  it("Verteilen ist erledigt, wenn alle Gruppen eingereicht haben", () => {
    const f = facts({ status: "running", groupCount: 3, submittedCount: 2 });
    expect(state(f).verteilen).toBe("current");
    expect(state({ ...f, submittedCount: 3 }).verteilen).toBe("done");
  });

  it("der Start schließt das Setup ab, auch wenn später ein Kandidat verschwindet", () => {
    // Die Start-Guards lassen die Runde nur laufen, wenn Rahmen, Ballot und
    // Gruppen standen — eine laufende Kachel darf nicht auf Phase 1 zurückfallen.
    const s = state(facts({ status: "running", groupCount: 2 }));
    expect([s.rahmen, s.ballot, s.gruppen]).toEqual(["done", "done", "done"]);
    expect(s.verteilen).toBe("current");
  });

  it("das Schließen der Verteilung beendet die Phase, auch bei fehlenden Abgaben", () => {
    // Die Deadline darf die Gruppen überholen.
    const s = state(facts({ status: "decided", groupCount: 3, submittedCount: 1 }));
    expect(s.verteilen).toBe("done");
    expect(s.finalisieren).toBe("current");
  });

  it("ohne Gruppen gilt Verteilen nicht als erledigt", () => {
    // Sonst wäre eine Kachel ohne Beteiligte formal „durchverteilt".
    expect(state(facts({ status: "running", groupCount: 0, submittedCount: 0 })).verteilen).toBe(
      "current",
    );
  });

  it("Finalisieren öffnet mit `decided`, Protokoll erst mit `closed`", () => {
    const decided = state(facts({ status: "decided", groupCount: 1, submittedCount: 1 }));
    expect(decided.finalisieren).toBe("current");
    expect(decided.protokoll).toBe("blocked");

    const closed = state(facts({ status: "closed", groupCount: 1, submittedCount: 1 }));
    expect(closed.finalisieren).toBe("done");
    expect(closed.protokoll).toBe("current");
  });

  it("jede Phase nennt den Reiter, der sie trägt", () => {
    expect(periodPhases(facts()).map((p) => p.tab)).toEqual([
      "setup",
      "setup",
      "setup",
      "setup",
      "verteilung",
      "ergebnis",
      "ergebnis",
    ]);
  });
});

describe("phaseSummary", () => {
  it("benennt die laufende Phase mit ihrer Nummer", () => {
    expect(phaseSummary(periodPhases(facts()))).toBe("Phase 1 · Rahmen");
    expect(
      phaseSummary(
        periodPhases(
          facts({
            status: "running",
            groupCount: 3,
            poolTotal: 1,
            hasTimeframe: true,
            candidateCount: 2,
            staffedGroupCount: 3,
          }),
        ),
      ),
    ).toBe("Phase 5 · Verteilen");
  });

  it("eine vollständig durchlaufene Kachel meldet sich als abgeschlossen", () => {
    const done = facts({
      status: "closed",
      poolTotal: 1,
      hasTimeframe: true,
      candidateCount: 2,
      staffedGroupCount: 2,
      groupCount: 2,
      submittedCount: 2,
      hasRevision: true,
    });
    expect(phaseSummary(periodPhases(done))).toBe("abgeschlossen");
  });
});
