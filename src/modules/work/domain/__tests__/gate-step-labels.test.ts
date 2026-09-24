import { describe, it, expect } from "vitest";
import {
  GATE_STEPS,
  GATE_STEP_KEYS,
  GATE_STEP_NUMBER_KEYS,
  LADDER_STEPS,
  gateStepKey,
  gateStepNumberKey,
} from "@/modules/work/domain/stage-gate";
import { catalogTranslate } from "@/test/helpers/catalog";

describe("Beschriftung der beantragbaren Schritte", () => {
  it("benennt jeden Schritt", () => {
    for (const step of GATE_STEPS) {
      expect(GATE_STEP_KEYS[step], `Schritt ${step} ohne Schlüssel`).toBeTruthy();
    }
  });

  it("nennt den Schritt L4 wie die Anzeige danach: L4.1", () => {
    // Der Schlüssel unterscheidet sich vom Major-Gate; dass auch die Wörter
    // auseinandergehen, prüft `initiative-labels.test.tsx` nebenan.
    expect(gateStepKey("L4")).toBe("work.gateStep.l4");
    expect(catalogTranslate("de")(gateStepKey("L4"))).toContain("L4.1");
  });

  it("lässt den gespeicherten Wert unangetastet — L4 bleibt ein Schritt namens L4", () => {
    expect(GATE_STEPS).toContain("L4");
    expect(GATE_STEPS).not.toContain("L4.1");
  });

  it("fällt bei unbekannten Werten auf den Wert selbst zurück", () => {
    expect(gateStepKey("L9")).toBe("L9");
  });
});

describe("Marke der beantragbaren Schritte", () => {
  it("führt für jeden Schritt eine eigene Marke", () => {
    // Bis September 2026 wurde die Marke aus dem Etikett geschnitten
    // (`label.split(" ")[0]`). Für die nummerierten Schritte ging das gut; aus
    // „Zur Analyse ausgewählt" wurde der Punkt „Zur", und der stand so auch in
    // der Epics-Tabelle („Wechsel nach Zur beantragt"). Jetzt steht jede Marke
    // ausgeschrieben da — dieser Test fällt auf, wenn ein künftiger Schritt
    // ohne Eintrag dazukommt.
    for (const step of GATE_STEPS) {
      expect(GATE_STEP_NUMBER_KEYS[step], `Schritt ${step} ohne Marke`).toBeTruthy();
    }
  });

  it("lässt genau die Schritte von der Leiter, deren Marke keine Nummer ist", () => {
    // Die eigentliche Aussage, und sie gilt in beiden Sprachen: wer keine
    // Nummer trägt, bewegt den Reifegrad nicht und gehört nicht auf die Leiter.
    for (const locale of ["de", "en"] as const) {
      const t = catalogTranslate(locale);
      for (const step of GATE_STEPS) {
        const marke = t(gateStepNumberKey(step));
        if (!/^L[0-9.]+$/.test(marke)) {
          expect(LADDER_STEPS, `${step} (${locale}) trägt keine Nummer`).not.toContain(step);
        }
      }
    }
  });

  it("nennt den nummernlosen Analyse-Schritt in beiden Sprachen mit einem Wort", () => {
    expect(gateStepNumberKey("analysis")).toBe("work.gateStepNumber.analysis");
    expect(catalogTranslate("de")(gateStepNumberKey("analysis"))).toBe("Analyse");
    expect(catalogTranslate("en")(gateStepNumberKey("analysis"))).toBe("Analysis");
  });

  it("lässt die Leiter kürzer als den Antragsweg", () => {
    // Zwei Listen, zwei Aussagen: `GATE_STEPS` ist der Antragsweg, `LADDER_STEPS`
    // der Reifegrad. Werden sie je gleich lang, hat jemand einen Schritt ohne
    // Reifegrad auf die Leiter gelassen.
    expect(LADDER_STEPS.length).toBe(GATE_STEPS.length - 1);
    expect(LADDER_STEPS).not.toContain("analysis");
  });
});
