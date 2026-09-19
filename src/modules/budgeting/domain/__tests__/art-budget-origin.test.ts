import { describe, it, expect } from "vitest";
import {
  buildArtBudgetOrigin,
  type ArtBudgetOriginInput,
} from "@/modules/budgeting/domain/art-budget-origin";

/**
 * Die Herkunftsrechnung eines ARTs. Geprüft wird vor allem das, was eine
 * Tabelle stillschweigend falsch machen kann: Betrieb in die Veränderung
 * ziehen, den nicht verteilten Rahmen unterschlagen, Anteile auf die falsche
 * Bezugsgrösse rechnen.
 */

const leer = { direct: 0, viaSolution: 0, keyed: 0 };

const eingabe = (over: Partial<ArtBudgetOriginInput> = {}): ArtBudgetOriginInput => ({
  cycleKey: "2026-H2",
  portfolio: 0,
  frame: { total: 0, toEpics: 0, toOwnWork: 0 },
  operating: leer,
  operatingAnnual: leer,
  operatingBasis: "awarded",
  ...over,
});

const betrag = (o: ReturnType<typeof buildArtBudgetOrigin>, key: string) =>
  o.rows.find((r) => r.key === key)?.amount;

describe("buildArtBudgetOrigin", () => {
  it("stellt sieben Zeilen in zwei Gruppen", () => {
    const o = buildArtBudgetOrigin(eingabe());
    expect(o.rows.map((r) => r.key)).toEqual([
      "portfolio",
      "frameDistributed",
      "frameOwnWork",
      "frameOpen",
      "operatingDirect",
      "operatingViaSolution",
      "operatingKeyed",
    ]);
    expect(o.rows.filter((r) => r.group === "change")).toHaveLength(4);
    expect(o.rows.filter((r) => r.group === "operating")).toHaveLength(3);
  });

  /**
   * **Die Trennung ist der Zweck der Tabelle.** Betriebsgeld bezahlt kein
   * Feature; stünde es in Σ Veränderung, rechnete jede Deckung daneben.
   */
  it("hält Betrieb aus Σ Veränderung heraus", () => {
    const o = buildArtBudgetOrigin(
      eingabe({ portfolio: 100, operating: { direct: 40, viaSolution: 0, keyed: 0 } }),
    );
    expect(o.changeTotal).toBe(100);
    expect(o.operatingTotal).toBe(40);
    expect(o.total).toBe(140);
  });

  /**
   * Der zugesprochene, aber nicht verteilte Rahmen gehört dem ART. Ohne diese
   * Zeile hiesse Σ „was ausgegeben wurde" — und der RTE fände das Geld nicht
   * wieder, über das er noch entscheidet.
   */
  it("weist den Rahmen getrennt aus: verteilt und noch nicht verteilt", () => {
    const o = buildArtBudgetOrigin(
      eingabe({ frame: { total: 100_000, toEpics: 76_250, toOwnWork: 20_000 } }),
    );
    expect(betrag(o, "frameDistributed")).toBe(76_250);
    expect(betrag(o, "frameOwnWork")).toBe(20_000);
    expect(betrag(o, "frameOpen")).toBe(3_750);
    // Wie der Rahmen aufgeteilt ist, ändert an Σ Veränderung nichts.
    expect(o.changeTotal).toBe(100_000);
  });

  it("zeigt einen gekürzten Rahmen als negative offene Zeile, statt ihn zu klemmen", () => {
    const o = buildArtBudgetOrigin(eingabe({ frame: { total: 50, toEpics: 60, toOwnWork: 20 } }));
    expect(betrag(o, "frameOpen")).toBe(-30);
    expect(o.changeTotal).toBe(50);
  });

  it("rechnet Anteile auf Σ gesamt und summiert auf 1", () => {
    const o = buildArtBudgetOrigin(
      eingabe({ portfolio: 300, operating: { direct: 100, viaSolution: 0, keyed: 0 } }),
    );
    expect(o.rows.find((r) => r.key === "portfolio")?.share).toBeCloseTo(0.75, 10);
    expect(o.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
  });

  it("gibt ohne Σ den Anteil 0 statt NaN", () => {
    const o = buildArtBudgetOrigin(eingabe());
    expect(o.rows.every((r) => r.share === 0)).toBe(true);
    expect(o.isEmpty).toBe(true);
  });

  /** Ein ART mit Rahmen, aber ohne Zuteilung, ist **nicht** leer. */
  it("ist nicht leer, sobald eine einzige Zeile trägt", () => {
    expect(
      buildArtBudgetOrigin(eingabe({ frame: { total: 1, toEpics: 0, toOwnWork: 0 } })).isEmpty,
    ).toBe(false);
  });

  it("kennzeichnet nur die geschlüsselte Zeile als Schätzung", () => {
    const o = buildArtBudgetOrigin(eingabe({ operating: { direct: 1, viaSolution: 1, keyed: 1 } }));
    expect(o.rows.filter((r) => r.estimated).map((r) => r.key)).toEqual(["operatingKeyed"]);
  });

  /** „p. a." gibt es nur für Betrieb — Veränderung wird je Halbjahr entschieden. */
  it("trägt einen Jahresbetrag nur im Betrieb", () => {
    const o = buildArtBudgetOrigin(
      eingabe({
        portfolio: 10,
        frame: { total: 10, toEpics: 0, toOwnWork: 0 },
        operating: { direct: 50, viaSolution: 0, keyed: 0 },
        operatingAnnual: { direct: 100, viaSolution: 0, keyed: 0 },
      }),
    );
    expect(o.rows.filter((r) => r.group === "change").every((r) => r.annual === null)).toBe(true);
    expect(o.rows.find((r) => r.key === "operatingDirect")?.annual).toBe(100);
  });
});

describe("die Überschrift der Betragsspalte", () => {
  it("heisst „beantragt“, solange nur unaufgeteilter Betrieb dasteht", () => {
    const o = buildArtBudgetOrigin(
      eingabe({ operating: { direct: 40, viaSolution: 0, keyed: 0 }, operatingBasis: "planned" }),
    );
    expect(o.basis).toBe("planned");
  });

  /**
   * Portfolio-Geld ist immer entschieden. Steht es neben unaufgeteiltem
   * Betrieb, wäre **jedes** einzelne Wort über der Spalte für die Hälfte der
   * Zeilen falsch.
   */
  it("ist gemischt, wenn entschiedenes Geld neben beantragtem steht", () => {
    const o = buildArtBudgetOrigin(
      eingabe({
        portfolio: 100,
        operating: { direct: 40, viaSolution: 0, keyed: 0 },
        operatingBasis: "planned",
      }),
    );
    expect(o.basis).toBe("mixed");
  });

  it("zählt nur Zeilen mit Betrag — leerer Betrieb macht nichts gemischt", () => {
    const o = buildArtBudgetOrigin(eingabe({ portfolio: 100, operatingBasis: "planned" }));
    expect(o.basis).toBe("awarded");
  });
});
