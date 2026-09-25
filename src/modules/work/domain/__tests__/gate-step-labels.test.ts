import { describe, it, expect } from "vitest";
import {
  GATE_STEPS,
  GATE_STEP_KEYS,
  GATE_STEP_NUMBER_KEYS,
  LADDER_STEPS,
  gateStepKey,
  gateStepLabel,
  gateStepNumberKey,
  gateStepNumberLabel,
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
    expect(gateStepLabel("L4", catalogTranslate("de"))).toContain("L4.1");
  });

  it("lässt den gespeicherten Wert unangetastet — L4 bleibt ein Schritt namens L4", () => {
    expect(GATE_STEPS).toContain("L4");
    expect(GATE_STEPS).not.toContain("L4.1");
  });

  /**
   * **Dieser Test hielt den Fehler fest, der im September 2026 die Epic-Liste
   * abstürzen liess.**
   *
   * Er lautete `expect(gateStepKey("L9")).toBe("L9")` — der Rückfall auf den
   * Rohwert, als Absicht dokumentiert. Zweiundzwanzig Aufrufstellen schrieben
   * `t(gateStepKey(x))`, und `t("L3.1")` wirft. Der Rückfall war nicht falsch
   * gedacht, nur am falschen Ort: er gehört dorthin, wo übersetzt wird.
   */
  it("gibt für unbekannte Werte keinen Schlüssel zurück", () => {
    expect(gateStepKey("L9")).toBeUndefined();
    expect(gateStepNumberKey("L9")).toBeUndefined();
  });

  it("zeigt einen unbekannten Schritt als Rohwert, statt zu werfen", () => {
    // `catalogTranslate` wirft bei jedem Schlüssel, den `de.json` nicht kennt —
    // genau wie `next-intl` zur Laufzeit. Käme hier ein Schlüssel heraus, wäre
    // dieser Aufruf der Absturz.
    const t = catalogTranslate("de");
    expect(gateStepLabel("L3.1", t)).toBe("L3.1");
    expect(gateStepNumberLabel("L3.1", t)).toBe("L3.1");
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
        const marke = gateStepNumberLabel(step, t);
        if (!/^L[0-9.]+$/.test(marke)) {
          expect(LADDER_STEPS, `${step} (${locale}) trägt keine Nummer`).not.toContain(step);
        }
      }
    }
  });

  it("nennt den nummernlosen Analyse-Schritt in beiden Sprachen mit einem Wort", () => {
    expect(gateStepNumberKey("analysis")).toBe("work.gateStepNumber.analysis");
    expect(gateStepNumberLabel("analysis", catalogTranslate("de"))).toBe("Analyse");
    expect(gateStepNumberLabel("analysis", catalogTranslate("en"))).toBe("Analysis");
  });

  it("lässt die Leiter kürzer als den Antragsweg", () => {
    // Zwei Listen, zwei Aussagen: `GATE_STEPS` ist der Antragsweg, `LADDER_STEPS`
    // der Reifegrad. Werden sie je gleich lang, hat jemand einen Schritt ohne
    // Reifegrad auf die Leiter gelassen.
    expect(LADDER_STEPS.length).toBe(GATE_STEPS.length - 1);
    expect(LADDER_STEPS).not.toContain("analysis");
  });
});
