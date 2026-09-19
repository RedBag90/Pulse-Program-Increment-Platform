import { describe, it, expect } from "vitest";
import { buildArtGridModel } from "@/modules/budgeting/server/views/art-budget-breakdown";
import type { ArtFeatureLoad } from "@/modules/budgeting/domain/art-budget";

const periods = [
  { key: "2026-H1", label: "H1 2026" },
  { key: "2026-H2", label: "H2 2026" },
];

const emptyLoad = (artId: string): ArtFeatureLoad => ({
  artId,
  byPeriod: {},
  backlog: { count: 0, jobSize: 0 },
  total: { count: 0, jobSize: 0 },
});

const row = (
  artId: string,
  budgetByPeriod: Record<string, number>,
  operatingPerCycle = 0,
  /** Der Rahmenanteil, der in `budgetByPeriod` bereits **enthalten** ist. */
  frameByPeriod: Record<string, number> = {},
) => ({
  artId,
  name: `ART ${artId}`,
  budgetByPeriod,
  frameByPeriod,
  load: emptyLoad(artId),
  operatingPerCycle,
});

describe("buildArtGridModel", () => {
  it("Verbleibend = Wertstrom-Budget minus Summe der ART-Budgets (REQ-A2)", () => {
    const model = buildArtGridModel({
      periods,
      vsByPeriod: { "2026-H1": 1000, "2026-H2": 800 },
      rows: [row("a", { "2026-H1": 300 }), row("b", { "2026-H1": 200, "2026-H2": 500 })],
    });
    expect(model.unassigned).toEqual({ "2026-H1": 500, "2026-H2": 300 });
  });

  it("Ueberverteilung ergibt einen negativen Rest", () => {
    const model = buildArtGridModel({
      periods,
      vsByPeriod: { "2026-H1": 100 },
      rows: [row("a", { "2026-H1": 250 })],
    });
    expect(model.unassigned["2026-H1"]).toBe(-150);
  });

  it("ohne ART ist das Modell leer — die Sicht zeigt dann nur einen Hinweis", () => {
    const model = buildArtGridModel({ periods, vsByPeriod: {}, rows: [] });
    expect(model.isEmpty).toBe(true);
    expect(model.unassigned).toEqual({ "2026-H1": 0, "2026-H2": 0 });
  });

  it("belegt jede Spalte, auch wenn weder Budget noch ART sie kennt", () => {
    const model = buildArtGridModel({
      periods,
      vsByPeriod: { "2026-H1": 10 },
      rows: [row("a", {})],
    });
    expect(Object.keys(model.unassigned)).toEqual(["2026-H1", "2026-H2"]);
    expect(model.isEmpty).toBe(false);
  });
});

/**
 * **REQ-10 — die Rechnung bleibt Veränderungsgeld.**
 *
 * `allocatedByPeriod` ist zugleich die Bezugsgrösse der Deckungsampel und der
 * Zähler des €-Satzes je Job-Size-Punkt. Flösse Betriebsgeld dort hinein,
 * geschähe zweierlei: die Ampel spränge auf „gedeckt", obwohl kein Euro davon
 * ein Feature bezahlt, und der Satz stiege — und da derselbe Satz die Last in
 * Euro **multipliziert**, verstärkte sich der Fehler ein zweites Mal.
 *
 * Deshalb steht das hier als Test und nicht als Kommentar.
 */
describe("REQ-10 — Betriebsgeld fasst die Rechnung nicht an", () => {
  it("lässt `allocatedByPeriod` unberührt, egal wie hoch das Betriebsgeld ist", () => {
    const ohne = buildArtGridModel({
      periods,
      vsByPeriod: { "2026-H1": 1000 },
      rows: [row("a", { "2026-H1": 300 }, 0)],
    });
    const mit = buildArtGridModel({
      periods,
      vsByPeriod: { "2026-H1": 1000 },
      rows: [row("a", { "2026-H1": 300 }, 9_999_999)],
    });
    expect(mit.allocatedByPeriod).toEqual(ohne.allocatedByPeriod);
    expect(mit.unassigned).toEqual(ohne.unassigned);
  });
});

/**
 * **Die Bezugsgröße muss mit den Zeilen wachsen.**
 *
 * Der Fehler, den diese Fälle festhalten: nähme die ART-Zeile den ART-Rahmen
 * auf und `vsByPeriod` nicht, stiege die Auslastung über 100 % und „Nicht
 * zugeordnet" würde negativ — beides eine Auskunft, die es nicht gibt.
 */
describe("der ART-Rahmen steckt in den Zeilen", () => {
  it("zählt Rahmen und Portfolio in derselben Zelle", () => {
    const model = buildArtGridModel({
      periods,
      // Portfolio 236.050 + Rahmen 135.000 — so steht es am Bestand.
      vsByPeriod: { "2026-H2": 371_050 },
      rows: [row("a1", { "2026-H2": 371_050 }, 0, { "2026-H2": 135_000 })],
    });
    expect(model.allocatedByPeriod["2026-H2"]).toBe(371_050);
    expect(model.unassigned["2026-H2"]).toBe(0);
    // Der Rahmenanteil bleibt getrennt lesbar — die Zelle nennt ihn im Titel.
    expect(model.rows[0]?.frameByPeriod["2026-H2"]).toBe(135_000);
  });

  it("meldet die Basis der Betriebsspalte", () => {
    const model = buildArtGridModel({
      periods,
      vsByPeriod: {},
      rows: [],
      operatingBasis: "awarded",
    });
    expect(model.operatingBasis).toBe("awarded");
  });

  /** Ohne Angabe bleibt es beim geplanten Betrag — der Stand vor REQ-8. */
  it("fällt ohne Angabe auf „beantragt“ zurück", () => {
    expect(buildArtGridModel({ periods, vsByPeriod: {}, rows: [] }).operatingBasis).toBe("planned");
  });
});
