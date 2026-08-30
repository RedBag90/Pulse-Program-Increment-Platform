import { describe, it, expect } from "vitest";
import { demoEpicDetailInputs, demoEpicDetailModel } from "../epic-detail-demo";

/**
 * Das Beispiel-Epic der Rollen-Tour rendert eine echte Produktoberfläche mit
 * erfundenen Inhalten. Zwei Zusicherungen müssen dabei halten, und beide werden
 * hier geprüft statt behauptet:
 *
 * 1. Es kann dort **nichts ausgelöst werden** — jedes `can*`-Flag ist `false`.
 * 2. Die Seite ist **stabil** — zwei Aufrufe liefern dasselbe, sonst würde sich
 *    die Einführung bei jedem Seitenaufruf verändern.
 */

describe("Beispiel-Epic (Fixture der Rollen-Tour)", () => {
  it("ist durchgängig schreibgeschützt — jedes can*-Flag ist false", () => {
    const inputs = demoEpicDetailInputs() as unknown as Record<string, unknown>;
    const enabled = Object.entries(inputs)
      .filter(([k]) => k.startsWith("can"))
      .filter(([, v]) => v !== false)
      .map(([k]) => k);
    expect(enabled).toEqual([]);
  });

  it("läuft durch denselben Builder wie das Produkt und liefert ein Modell", () => {
    const model = demoEpicDetailModel();
    expect(model.epic.title).toContain("Beispiel");
    expect(model.lifecycleSteps.length).toBeGreaterThan(0);
  });

  it("füllt die Reiter, durch die die Tour führt", () => {
    const model = demoEpicDetailModel();
    // Hypothese und Business Case tragen Inhalt — sonst zeigt die Tour leere Formulare.
    expect(model.benefitHypothesis.current.measuresHypothesis).toBeTruthy();
    expect(model.businessCase.current.initiativeDescription).toBeTruthy();
    // Deliverables: die Breakdown-Sicht braucht Zeilen, um etwas zu zeigen.
    expect(model.breakdownFeatures.length).toBeGreaterThan(0);
  });

  it("ist stabil — zwei Aufrufe liefern dasselbe", () => {
    // Ein `new Date()` im Fixture würde die Beispielseite bei jedem Aufruf
    // verändern; der Reifegrad springt dann scheinbar grundlos.
    expect(JSON.stringify(demoEpicDetailModel())).toBe(JSON.stringify(demoEpicDetailModel()));
  });

  it("hängt an keinem echten Tenant — das Beispiel darf nie mit Produktivdaten kollidieren", () => {
    expect(demoEpicDetailInputs().epic.tenantId).toMatch(/^0{8}-/);
  });
});
