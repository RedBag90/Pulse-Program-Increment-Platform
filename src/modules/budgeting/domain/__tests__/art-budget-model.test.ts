import { describe, it, expect } from "vitest";
import {
  artDetailIsEmpty,
  type ArtBudgetDetail,
} from "@/modules/budgeting/domain/art-budget-model";

/**
 * „Ist hier überhaupt etwas?" — die Frage, die entscheidet, ob eine aufgeklappte
 * ART-Zeile eine Fläche aus Nullen zeigt oder einen Satz.
 */

const LEER: ArtBudgetDetail = {
  artId: "a1",
  cycles: [{ key: "2026-H1", label: "2026 H1" }],
  cycleKey: "2026-H1",
  sources: [
    {
      source: "portfolio",
      label: "Portfolio",
      breakdown: {
        total: 0,
        byState: { notStarted: 0, committed: 0, consumed: 0 },
        countByState: { notStarted: 0, committed: 0, consumed: 0 },
        rows: [],
      },
      titles: {},
    },
  ],
  switchedArt: [],
  epicsWithoutArt: { count: 0, amount: 0 },
  unfunded: [],
  coverage: null,
  pot: null,
  rtb: { run: [], change: [] },
};

describe("artDetailIsEmpty", () => {
  it("nennt ein ART ohne alles leer", () => {
    expect(artDetailIsEmpty(LEER)).toBe(true);
  });

  /**
   * **Der Fall, für den die Funktion überhaupt existiert.** Ein ART ohne einen
   * Euro, aber mit eingeplanten Features, ist die interessanteste Lage
   * überhaupt: da ist Arbeit vorgesehen, für die kein Geld da ist. Würde die
   * Zeile hier „nichts zugeteilt" sagen und zuklappen, verschwände genau der
   * Befund, den die Deckungsampel melden soll.
   */
  it("nennt ein ART mit Feature-Last **nicht** leer, auch ohne einen Euro", () => {
    expect(
      artDetailIsEmpty({
        ...LEER,
        coverage: {
          plannedJobSize: 240,
          featureCount: 22,
          plannedStandalone: { jobSize: 0, count: 0 },
          rate: {
            source: "none",
            rate: null,
            cycles: [],
            budgetSum: 0,
            jobSizeSum: 0,
            featureCount: 0,
            standaloneJobSizeSum: 0,
            standaloneFeatureCount: 0,
            caveats: [],
          },
          loadEuro: null,
          allocated: 0,
          gap: null,
        },
      }),
    ).toBe(false);
  });

  it("nennt ein ART mit Zuteilung nicht leer", () => {
    const [first] = LEER.sources;
    expect(
      artDetailIsEmpty({
        ...LEER,
        sources: [{ ...first!, breakdown: { ...first!.breakdown, total: 10_000 } }],
      }),
    ).toBe(false);
  });

  /**
   * Ein Epic, das beantragt und **abgelehnt** wurde, ist eine Auskunft — und
   * zwar eine, die sonst nirgends steht.
   */
  it("nennt ein ART mit abgelehntem Antrag nicht leer", () => {
    expect(
      artDetailIsEmpty({
        ...LEER,
        unfunded: [
          { epicId: "e1", title: "Abgelehnt", stageGate: "L3", ask: 50_000, reason: "ballot" },
        ],
      }),
    ).toBe(false);
  });

  it("nennt ein ART mit Betriebsposition nicht leer", () => {
    expect(
      artDetailIsEmpty({
        ...LEER,
        rtb: {
          run: [{ id: "i1", name: "Betrieb", cycleAmount: 10, annualAmount: 20 }],
          change: [],
        },
      }),
    ).toBe(false);
  });
});
