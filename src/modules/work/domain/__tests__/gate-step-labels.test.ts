import { describe, it, expect } from "vitest";
import { GATE_STEPS, GATE_STEP_LABELS, gateStepLabel } from "@/modules/work/domain/stage-gate";

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
