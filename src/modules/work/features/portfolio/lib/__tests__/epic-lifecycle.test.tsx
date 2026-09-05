import { describe, it, expect } from "vitest";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";
import {
  epicLifecycleSteps,
  LIFECYCLE_STEPS,
  type EpicLifecycleInput,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";

function input(over: Partial<EpicLifecycleInput> = {}): EpicLifecycleInput {
  return {
    stageGate: "L0",
    subStage: null,
    impactRecognizedAt: null,
    ...over,
  };
}

/** key of the single `current` step, or null when all done. */
function current(over: Partial<EpicLifecycleInput> = {}): string | null {
  return epicLifecycleSteps(input(over)).find((s) => s.status === "current")?.key ?? null;
}

const D = new Date("2026-01-01");

describe("epicLifecycleSteps", () => {
  it("has all 9 ordered steps with descriptions", () => {
    expect(LIFECYCLE_STEPS).toHaveLength(9);
    expect(LIFECYCLE_STEPS.every((s) => s.description.length > 0)).toBe(true);
    expect(LIFECYCLE_STEPS[0]!.key).toBe("funnel");
    expect(LIFECYCLE_STEPS[8]!.key).toBe("done");
  });

  it("L0: nur Funnel abgehakt, Hypothese current (matches next-step)", () => {
    // Hier stand: „Funnel + Detailing done". Ein frisch angelegtes Epic zeigte
    // damit einen gruenen Haken auf „L1 Detailing · Owner nominiert", obwohl es
    // im Funnel stand und keinen Owner hatte.
    const steps = epicLifecycleSteps(input({ stageGate: "L0" }));
    expect(steps[0]!.status).toBe("done"); // funnel
    expect(steps[1]!.status).toBe("upcoming"); // detailing — Gate nicht erreicht
    expect(steps[2]!.key).toBe("hypothesis");
    expect(steps[2]!.status).toBe("current");
    expect(steps.slice(3).every((s) => s.status === "upcoming")).toBe(true);
  });

  it("L0: kein Haken auf einem Schritt, den das Epic nicht erreicht hat", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L0" }));
    expect(steps.filter((s) => s.status === "done").map((s) => s.key)).toEqual(["funnel"]);
  });

  it("eine Auswahl-Markierung haelt nie den Punkt", () => {
    // Sie traegt keine Handlung — sie faellt an, wenn das Gate gezeichnet wird.
    expect(current({ stageGate: "L0" })).not.toBe("detailing");
    expect(current({ stageGate: "L1" })).not.toBe("analyzing");
  });

  it("L1: Business Case current (hypothesis approved, BC pending)", () => {
    expect(current({ stageGate: "L1" })).toBe("business_case");
  });

  it("L2 (BC in Arbeit): Business Case current", () => {
    expect(current({ stageGate: "L2" })).toBe("business_case");
  });

  it("L3.1 (BC freigegeben): Backlog current", () => {
    expect(current({ stageGate: "L3", subStage: "L3.1" })).toBe("backlog");
  });

  it("regression — L3 with no milestone timestamps: Backlog current (was Detailing)", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L3" }));
    expect(steps.slice(0, 5).every((s) => s.status === "done")).toBe(true); // funnel..business_case
    expect(steps[5]!.key).toBe("backlog");
    expect(steps[5]!.status).toBe("current");
    expect(steps.slice(6).every((s) => s.status === "upcoming")).toBe(true);
  });

  it("L4 (läuft): Umsetzung ▸ Start current", () => {
    expect(current({ stageGate: "L4", subStage: "L4.1" })).toBe("implementation_started");
  });

  it("L4.2 (Umsetzung abgenommen): Umsetzung ▸ Fertig current", () => {
    // Nur die abgenommene Bestätigung rückt den Schritt vor — fertige Features
    // allein tun es seit dem beantragten L4.2 nicht mehr.
    expect(current({ stageGate: "L4", subStage: "L4.2" })).toBe("implementation");
  });

  it("L5: every step done, no current", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L5" }));
    expect(steps.every((s) => s.status === "done")).toBe(true);
    expect(steps.some((s) => s.status === "current")).toBe(false);
  });

  it("impactRecognizedAt set (any gate): Impact done, no current", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L4", impactRecognizedAt: D }));
    expect(steps[8]!.status).toBe("done");
  });
});

describe("ein Wortschatz", () => {
  it("beschriftet jeden Schritt deutsch und ohne Altbestand", () => {
    // Die Zeitleiste schrieb ihre neun Zeilen einmal selbst, auf Englisch
    // („Selected for Detailing", „Business hypothesis done"), waehrend der
    // Stepper darueber diese Liste las. Jetzt lesen beide dasselbe.
    const alt = [
      "Funnel Entry",
      "Selected for Detailing",
      "Business hypothesis done",
      "Selected for analyzing",
      "Implementation started",
      "Implementation done",
      "Impact Realized",
    ];
    for (const step of LIFECYCLE_STEPS) {
      expect(alt).not.toContain(step.label);
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  it("gibt jedem Gate ein Kurzlabel", () => {
    // Faengt die naechste Dublette, bevor sie entsteht: ein neues Gate ohne
    // Wort faellt hier auf, nicht erst auf der Flaeche.
    for (const step of LIFECYCLE_STEPS) {
      expect(STAGE_SHORT[step.gate]).toBeTruthy();
    }
  });
});
