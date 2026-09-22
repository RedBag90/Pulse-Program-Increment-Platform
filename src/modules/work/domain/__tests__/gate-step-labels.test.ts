import { describe, it, expect } from "vitest";
import {
  GATE_STEPS,
  GATE_STEP_LABELS,
  LADDER_STEPS,
  gateStepLabel,
  gateStepNumber,
} from "@/modules/work/domain/stage-gate";

describe("Beschriftung der beantragbaren Schritte", () => {
  it("beschriftet jeden Schritt", () => {
    for (const step of GATE_STEPS) {
      expect(GATE_STEP_LABELS[step], `Schritt ${step} ohne Label`).toBeTruthy();
    }
  });

  it("nennt den Schritt L4 wie die Anzeige danach: L4.1", () => {
    expect(gateStepLabel("L4")).toBe("L4.1 Umsetzung läuft");
  });

  it("lässt den gespeicherten Wert unangetastet — L4 bleibt ein Schritt namens L4", () => {
    expect(GATE_STEPS).toContain("L4");
    expect(GATE_STEPS).not.toContain("L4.1");
  });

  it("fällt bei unbekannten Werten auf den Wert selbst zurück", () => {
    expect(gateStepLabel("L9")).toBe("L9");
  });
});

describe("Marke der beantragbaren Schritte", () => {
  it("gibt fuer jeden Schritt eine ganze Marke, kein abgeschnittenes Wort", () => {
    // Die Marke wird aus dem Etikett abgeleitet. Fuer die nummerierten Schritte
    // ist das richtig; fuer einen nummernlosen ergaebe es Unsinn — aus „Zur
    // Analyse ausgewaehlt" wurde bis September 2026 der Punkt „Zur", und der
    // stand so auch in der Epics-Tabelle („Wechsel nach Zur beantragt").
    //
    // Dieser Test faellt auf, sobald ein kuenftiger Schritt ohne Nummer
    // dazukommt, ohne in `NUMBERLESS` eine eigene Marke zu bekommen.
    for (const step of GATE_STEPS) {
      const mark = gateStepNumber(step);
      expect(mark, `Schritt ${step} ohne Marke`).toBeTruthy();
      if (!/^L[0-9.]+$/.test(mark)) {
        expect(
          LADDER_STEPS,
          `${step} traegt keine Nummer und gehoert nicht auf die Leiter`,
        ).not.toContain(step);
      }
    }
  });

  it("nennt den nummernlosen Analyse-Schritt „Analyse\u201c", () => {
    expect(gateStepNumber("analysis")).toBe("Analyse");
  });

  it("laesst die Leiter kuerzer als den Antragsweg", () => {
    // Zwei Listen, zwei Aussagen: `GATE_STEPS` ist der Antragsweg, `LADDER_STEPS`
    // der Reifegrad. Werden sie je gleich lang, hat jemand einen Schritt ohne
    // Reifegrad auf die Leiter gelassen.
    expect(LADDER_STEPS.length).toBe(GATE_STEPS.length - 1);
    expect(LADDER_STEPS).not.toContain("analysis");
  });
});
