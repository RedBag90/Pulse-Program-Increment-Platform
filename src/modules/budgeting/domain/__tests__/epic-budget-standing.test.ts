import { describe, it, expect } from "vitest";
import { chooseAllocation, chooseAllocations } from "@/modules/work/domain/epic-allocation-choice";
import {
  epicBudgetStanding,
  type StandingRound,
} from "@/modules/budgeting/domain/epic-budget-standing";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const NOW = new Date("2026-09-06T12:00:00.000Z");

const round = (cycleKey: string, status: string, start: string, end: string): StandingRound => ({
  id: cycleKey,
  cycleKey,
  status,
  startDate: D(start),
  endDate: D(end),
});

/** Der gemessene Bestand aus Large Test Corp. */
const ROUNDS: StandingRound[] = [
  round("2026-H1", "closed", "2026-01-05", "2026-07-02"),
  round("2026-H2", "closed", "2026-07-05", "2026-12-30"),
  round("2027-H1", "running", "2027-01-05", "2027-07-02"),
];

describe("chooseAllocation — ein Euro, ein Topf", () => {
  it("nimmt bei einem ART-Epic die ART-Zuteilung", () => {
    expect(chooseAllocation({ portfolio: 80_000, art: 80_000, epicClass: "art" })).toBe(80_000);
  });

  it("addiert nie — der Large-Test-Fall ergibt genau einmal 80.000", () => {
    // Dort ist derselbe Euro in beiden Tabellen gespiegelt. Zu addieren wäre
    // eine glatte Verdopplung.
    for (const epicClass of ["art", "portfolio", null] as const) {
      expect(chooseAllocation({ portfolio: 80_000, art: 80_000, epicClass })).toBe(80_000);
    }
  });

  it("verliert kein Geld, wenn der Topf der Klasse leer ist", () => {
    // Der Pulse-Demo-Fall: Klasse „portfolio", aber 100.000 aus dem ART-Topf
    // und nichts aus dem eigenen. Streng nach Klasse fiele das Geld weg.
    expect(chooseAllocation({ portfolio: 0, art: 100_000, epicClass: "portfolio" })).toBe(100_000);
    expect(chooseAllocation({ portfolio: 40_000, art: 0, epicClass: "art" })).toBe(40_000);
  });

  it("nimmt ohne Klasse, was da ist", () => {
    expect(chooseAllocation({ portfolio: 0, art: 76_000, epicClass: null })).toBe(76_000);
    expect(chooseAllocation({ portfolio: 0, art: 0, epicClass: null })).toBe(0);
  });

  it("faltet beide Karten und lässt leere Zyklen weg", () => {
    expect(
      chooseAllocations({ "2026-H1": 0, "2026-H2": 50_000 }, { "2026-H1": 40_000 }, "art"),
    ).toEqual({ "2026-H1": 40_000, "2026-H2": 50_000 });
  });
});

describe("epicBudgetStanding", () => {
  it("meldet «gilt jetzt», wenn Geld im angewandten Rahmen liegt", () => {
    const s = epicBudgetStanding({ byCycle: { "2026-H2": 80_000 }, rounds: ROUNDS, now: NOW });
    expect(s.state).toBe("applies");
    expect(s.currentAmount).toBe(80_000);
    expect(s.currentPeriod?.cycleKey).toBe("2026-H2");
    expect(s.totalAmount).toBe(80_000);
  });

  it("trennt den geltenden Betrag von der Gesamtsumme", () => {
    const s = epicBudgetStanding({
      byCycle: { "2026-H1": 60_000, "2026-H2": 80_000, "2027-H1": 100_000 },
      rounds: ROUNDS,
      now: NOW,
    });
    expect(s.currentAmount).toBe(80_000);
    expect(s.totalAmount).toBe(240_000);
    expect(s.cycleCount).toBe(3);
    expect(s.span).toEqual({ start: D("2026-01-05"), end: D("2027-07-02") });
  });

  it("meldet «zugeteilt, gilt ab …», wenn nur ein künftiger Rahmen trägt", () => {
    const s = epicBudgetStanding({ byCycle: { "2027-H1": 100_000 }, rounds: ROUNDS, now: NOW });
    expect(s.state).toBe("upcoming");
    expect(s.currentAmount).toBe(0);
    expect(s.startsAt).toEqual(D("2027-01-05"));
  });

  it("meldet «abgelaufen», wenn nur vergangene Rahmen tragen", () => {
    const s = epicBudgetStanding({ byCycle: { "2026-H1": 60_000 }, rounds: ROUNDS, now: NOW });
    expect(s.state).toBe("expired");
    expect(s.currentAmount).toBe(0);
    expect(s.totalAmount).toBe(60_000);
  });

  it("meldet «kein Budget» ohne jede Zuteilung", () => {
    const s = epicBudgetStanding({ byCycle: {}, rounds: ROUNDS, now: NOW });
    expect(s.state).toBe("none");
    expect(s.totalAmount).toBe(0);
    expect(s.span).toBeNull();
    expect(s.currentPeriod).toBeNull();
  });

  it("gilt nicht, solange der laufende Rahmen noch in Ausarbeitung ist", () => {
    // Der Pulse-Demo-Fall: die Kachel, deren Zeitraum heute läuft, ist `running`.
    // Ihr Geld ist zugeteilt, gilt aber nicht — und `startsAt` bleibt leer, weil
    // ihr Zeitraum längst begonnen hat.
    const rounds = [round("2026-H2", "running", "2026-08-05", "2027-02-01")];
    const s = epicBudgetStanding({ byCycle: { "2026-H2": 90_000 }, rounds, now: NOW });
    expect(s.state).toBe("upcoming");
    expect(s.currentAmount).toBe(0);
    expect(s.startsAt).toBeNull();
  });

  it("zählt Geld ohne Kachel in die Summe, aber nie als geltend", () => {
    // Alt-Daten: eine Zuteilung in einem Halbjahr, zu dem es keine Kachel gibt.
    const s = epicBudgetStanding({ byCycle: { "2019-H1": 12_000 }, rounds: ROUNDS, now: NOW });
    expect(s.totalAmount).toBe(12_000);
    expect(s.currentAmount).toBe(0);
    expect(s.span).toBeNull();
    expect(s.state).toBe("expired");
  });
});
