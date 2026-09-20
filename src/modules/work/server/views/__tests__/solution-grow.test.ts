import { describe, it, expect } from "vitest";
import {
  investByPrimarySolution,
  type InvestEpicFacts,
  type SolutionInvestPorts,
} from "@/modules/work/server/views/solution-grow";
import type { EpicClassLike } from "@/modules/work/domain/epic-allocation-choice";

/**
 * **Die Zahl auf der Solution-Kachel ist die Zuteilung eines Halbjahres.**
 *
 * Bis September 2026 war es die Life-Time-Summe: Σ Umsetzungskosten aller
 * freigegebenen, nicht abgeschlossenen Primär-Epics, ohne jeden Zeitbezug — ein
 * Epic, das bis 2029 läuft, zählte in jedem Halbjahr vollständig, und daneben
 * stand ein Jahreswert für den Betrieb. Zwei Zahlen, zwei Perioden.
 *
 * Geprüft wird deshalb vor allem, was **nicht** mehr passiert: Kosten ohne
 * Zuteilung zählen nicht, und die beiden Töpfe werden nie addiert.
 */
const epic = (id: string, solutionId: string | null): InvestEpicFacts => ({
  id,
  primarySolutionId: solutionId,
});

const ports = (over: Partial<SolutionInvestPorts> = {}): SolutionInvestPorts => ({
  cycleAllocations: {},
  artAllocations: {},
  epicClasses: new Map<string, { epicClass: EpicClassLike }>(),
  ...over,
});

describe("investByPrimarySolution", () => {
  it("summiert die Zuteilung des Zyklus je Solution", () => {
    const out = investByPrimarySolution(
      [epic("e1", "s1"), epic("e2", "s1"), epic("e3", "s2")],
      ports({ cycleAllocations: { e1: 100, e2: 50, e3: 700 } }),
    );
    expect(out.get("s1")).toEqual({ grow: 150, epicCount: 2 });
    expect(out.get("s2")).toEqual({ grow: 700, epicCount: 1 });
  });

  /**
   * Der Kern der Umstellung: früher trug dieses Epic seine vollen
   * Umsetzungskosten — in jedem Halbjahr aufs Neue.
   */
  it("gibt einem Epic ohne Zuteilung 0, zählt es aber mit", () => {
    const out = investByPrimarySolution([epic("e1", "s1")], ports());
    expect(out.get("s1")).toEqual({ grow: 0, epicCount: 1 });
  });

  /**
   * **Ein Euro, ein Topf.** Zu addieren wäre in einem Mandanten, dessen Töpfe
   * denselben Betrag spiegeln, eine glatte Verdopplung.
   */
  it("wählt den Topf, statt beide zu addieren", () => {
    const beide = { cycleAllocations: { e1: 300 }, artAllocations: { e1: 300 } };
    const alsArt = investByPrimarySolution(
      [epic("e1", "s1")],
      ports({ ...beide, epicClasses: new Map([["e1", { epicClass: "art" as const }]]) }),
    );
    const alsPortfolio = investByPrimarySolution(
      [epic("e1", "s1")],
      ports({ ...beide, epicClasses: new Map([["e1", { epicClass: "portfolio" as const }]]) }),
    );
    expect(alsArt.get("s1")?.grow).toBe(300);
    expect(alsPortfolio.get("s1")?.grow).toBe(300);
  });

  /** Ein leerer Topf tritt zurück — eine vorläufige Einordnung verschluckt kein Geld. */
  it("nimmt den anderen Topf, wenn der gewählte leer ist", () => {
    const out = investByPrimarySolution(
      [epic("e1", "s1")],
      ports({
        artAllocations: { e1: 292_000 },
        epicClasses: new Map([["e1", { epicClass: "portfolio" as const }]]),
      }),
    );
    expect(out.get("s1")?.grow).toBe(292_000);
  });

  it("übergeht Epics ohne Primär-Solution", () => {
    const out = investByPrimarySolution(
      [epic("e1", null)],
      ports({ cycleAllocations: { e1: 999 } }),
    );
    expect(out.size).toBe(0);
  });

  it("zählt auch eine Solution, deren Epics alle leer ausgehen", () => {
    const out = investByPrimarySolution([epic("e1", "s1"), epic("e2", "s1")], ports());
    expect(out.get("s1")).toEqual({ grow: 0, epicCount: 2 });
  });
});
