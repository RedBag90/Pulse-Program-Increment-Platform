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

const row = (artId: string, budgetByPeriod: Record<string, number>) => ({
  artId,
  name: `ART ${artId}`,
  budgetByPeriod,
  load: emptyLoad(artId),
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
