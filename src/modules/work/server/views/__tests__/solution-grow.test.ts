import { describe, it, expect } from "vitest";
import {
  growByPrimarySolution,
  countsTowardGrow,
  type GrowEpicFacts,
} from "@/modules/work/server/views/solution-grow";

/**
 * **Das Portfolio finanziert die Umsetzung, nicht die Erarbeitung des Business
 * Case.**
 *
 * Der gemeldete Fehler: der Filter stand auf `stageGate !== "L5"` und zaehlte
 * damit ab L0. Ein Epic darf seinen Lean Business Case ab L2 fuehren — dort ist
 * er aber *in Arbeit*, eine Rechnung, die noch niemand freigegeben hat. Bei
 * einer Solution im Datenbestand kamen so 270.000 € von 334.000 € (81 %) aus
 * einem einzigen L2-Epic, und diese Zahl steht neben der Run-Kachel aus echten
 * Betriebskosten.
 *
 * Fuer diese Datei gab es keinen Test.
 */

const bc = (...amounts: number[]): unknown => ({
  costSlices: amounts.map((amount, i) => ({ amount, period: `2026-H${(i % 2) + 1}` })),
});

const epic = (over: Partial<GrowEpicFacts> = {}): GrowEpicFacts => ({
  primarySolutionId: "s1",
  stageGate: "L3",
  businessCaseApprovedAt: new Date("2026-03-01"),
  businessCase: bc(100_000),
  ...over,
});

describe("countsTowardGrow", () => {
  it("verlangt die Freigabe des Business Case", () => {
    expect(countsTowardGrow({ stageGate: "L2", businessCaseApprovedAt: null })).toBe(false);
    expect(countsTowardGrow({ stageGate: "L3", businessCaseApprovedAt: new Date() })).toBe(true);
  });

  /** Grow misst, was gerade investiert wird — nicht, was einmal investiert wurde. */
  it("laesst ein abgeschlossenes Epic (L5) heraus, auch mit Freigabe", () => {
    expect(countsTowardGrow({ stageGate: "L5", businessCaseApprovedAt: new Date() })).toBe(false);
  });
});

describe("growByPrimarySolution", () => {
  it("summiert nur die freigegebenen, noch laufenden Epics", () => {
    const rows = growByPrimarySolution([
      epic({ businessCase: bc(40_000, 60_000) }),
      epic({ stageGate: "L4", businessCase: bc(30_000) }),
    ]);
    expect(rows.get("s1")).toEqual({ grow: 130_000, epicCount: 2 });
  });

  /** Der gemeldete Fehler, als Zusicherung. */
  it("zaehlt den Entwurf eines L2-Epics nicht mit", () => {
    const rows = growByPrimarySolution([
      epic({ businessCase: bc(64_000) }),
      epic({ stageGate: "L2", businessCaseApprovedAt: null, businessCase: bc(270_000) }),
    ]);
    // Frueher: 334.000 €, davon 81 % aus dem unbeschlossenen Entwurf.
    expect(rows.get("s1")?.grow).toBe(64_000);
  });

  /**
   * Die Anzahl hat **keine** Schwelle. „3 Epics haengen an dieser Solution" ist
   * eine Aussage ueber Zuordnung, nicht ueber Geld — sonst verschwaende ein
   * Epic aus der Liste, nur weil sein Business Case noch laeuft.
   */
  it("zaehlt jedes zugeordnete Epic, auch das unreife und das fertige", () => {
    const rows = growByPrimarySolution([
      epic(),
      epic({ stageGate: "L2", businessCaseApprovedAt: null }),
      epic({ stageGate: "L5" }),
    ]);
    expect(rows.get("s1")?.epicCount).toBe(3);
  });

  it("uebergeht Epics ohne Primaer-Solution", () => {
    const rows = growByPrimarySolution([epic({ primarySolutionId: null })]);
    expect(rows.size).toBe(0);
  });
});
