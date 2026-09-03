import { describe, it, expect } from "vitest";

import {
  isClassShown,
  hiddenClass,
  hiddenClassLabel,
  rollUpBySolution,
  NO_SOLUTION_LABEL,
} from "@/modules/work/domain/epic-class-filter";

const sol = (id: string, name: string) => ({ id, name });

describe("isClassShown", () => {
  it("schränkt ohne Auswahl nichts ein", () => {
    expect(isClassShown("art", [])).toBe(true);
    expect(isClassShown("portfolio", [])).toBe(true);
    expect(isClassShown(null, [])).toBe(true);
  });

  // Vor L3.1 ist nicht entschieden, wie groß das Vorhaben ist — der Funnel
  // bleibt beim Portfolio.
  it("zählt ein Epic ohne Business Case zur Portfolio-Seite", () => {
    expect(isClassShown(null, ["portfolio"])).toBe(true);
    expect(isClassShown(null, ["art"])).toBe(false);
  });

  it("trennt die beiden Klassen in beide Richtungen", () => {
    expect(isClassShown("art", ["art"])).toBe(true);
    expect(isClassShown("art", ["portfolio"])).toBe(false);
    expect(isClassShown("portfolio", ["portfolio"])).toBe(true);
    expect(isClassShown("portfolio", ["art"])).toBe(false);
  });

  it("zeigt bei beiden gewählten Werten wieder alles", () => {
    const both = ["portfolio", "art"];
    expect(isClassShown(null, both)).toBe(true);
    expect(isClassShown("art", both)).toBe(true);
  });
});

describe("hiddenClass / hiddenClassLabel", () => {
  it("nennt die zusammengefasste Klasse", () => {
    expect(hiddenClass(["portfolio"])).toBe("art");
    expect(hiddenClassLabel(["portfolio"])).toBe("ART-Epics");
    expect(hiddenClass(["art"])).toBe("portfolio");
    expect(hiddenClassLabel(["art"])).toBe("Portfolio-Epics");
  });

  it("verbirgt nichts, wenn nichts oder alles gewählt ist", () => {
    expect(hiddenClass([])).toBeNull();
    expect(hiddenClassLabel([])).toBeNull();
    expect(hiddenClass(["portfolio", "art"])).toBeNull();
    expect(hiddenClassLabel(["portfolio", "art"])).toBeNull();
  });
});

describe("rollUpBySolution", () => {
  it("gruppiert je Solution, größte Gruppe zuerst", () => {
    const rows = rollUpBySolution([
      { solution: sol("s1", "Produktion Betrieb") },
      { solution: sol("s2", "Logistik Betrieb") },
      { solution: sol("s1", "Produktion Betrieb") },
      { solution: sol("s1", "Produktion Betrieb") },
    ]);
    expect(rows).toEqual([
      { solutionId: "s1", name: "Produktion Betrieb", count: 3, overdue: 0 },
      { solutionId: "s2", name: "Logistik Betrieb", count: 1, overdue: 0 },
    ]);
  });

  it("sortiert bei gleicher Anzahl alphabetisch", () => {
    const rows = rollUpBySolution([
      { solution: sol("s2", "Werksverbund") },
      { solution: sol("s1", "Archiv") },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Archiv", "Werksverbund"]);
  });

  // Stille Verrechnung wäre eine Behauptung über eine Zuordnung, die es nicht gibt.
  it("führt Epics ohne Primär-Solution als eigene Gruppe", () => {
    const rows = rollUpBySolution([
      { solution: null },
      { solution: sol("s1", "Produktion Betrieb") },
      { solution: null },
    ]);
    expect(rows[0]).toEqual({
      solutionId: null,
      name: NO_SOLUTION_LABEL,
      count: 2,
      overdue: 0,
    });
  });

  it("zählt die überfälligen mit, ohne eine Dauer zu mitteln", () => {
    const rows = rollUpBySolution([
      { solution: sol("s1", "Produktion Betrieb"), overdue: true },
      { solution: sol("s1", "Produktion Betrieb"), overdue: false },
      { solution: sol("s1", "Produktion Betrieb"), overdue: true },
    ]);
    expect(rows[0]).toMatchObject({ count: 3, overdue: 2 });
  });

  it("liefert für eine leere Menge nichts", () => {
    expect(rollUpBySolution([])).toEqual([]);
  });
});
