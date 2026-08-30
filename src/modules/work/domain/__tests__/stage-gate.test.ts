import { describe, it, expect } from "vitest";
import {
  STAGE_GATES,
  STAGE_GATE_TRANSITIONS,
  isValidTransition,
  isApprovalTransition,
  subStageFor,
  GATE_STEPS,
  isValidStepTransition,
  gateOfStep,
  currentGateStep,
} from "@/modules/work/domain/stage-gate";

describe("STAGE_GATES", () => {
  it("lists the six gates L0–L5 in order", () => {
    expect(STAGE_GATES).toEqual(["L0", "L1", "L2", "L3", "L4", "L5"]);
  });
});

describe("isValidTransition", () => {
  it("allows a single step forward", () => {
    expect(isValidTransition("L0", "L1")).toBe(true);
    expect(isValidTransition("L2", "L3")).toBe(true);
    expect(isValidTransition("L4", "L5")).toBe(true);
  });

  it("allows a single step back", () => {
    expect(isValidTransition("L1", "L0")).toBe(true);
    expect(isValidTransition("L3", "L2")).toBe(true);
  });

  it("rejects skipping gates", () => {
    expect(isValidTransition("L0", "L2")).toBe(false);
    expect(isValidTransition("L0", "L3")).toBe(false);
    expect(isValidTransition("L1", "L4")).toBe(false);
  });

  it("rejects a no-op transition to the same gate", () => {
    expect(isValidTransition("L2", "L2")).toBe(false);
  });

  it("treats L5 as forward-terminal (only steps back to L4)", () => {
    expect(STAGE_GATE_TRANSITIONS.L5).toEqual(["L4"]);
    expect(isValidTransition("L5", "L4")).toBe(true);
  });
});

describe("isApprovalTransition", () => {
  it("ist genau der Schritt L3 → L3.2 (die Investitionsentscheidung)", () => {
    expect(isApprovalTransition("L3.2")).toBe(true);
  });

  it("ist für jeden anderen Schritt falsch — auch für den Eintritt L3.1", () => {
    // L3.1 ist nur „Business Case freigegeben"; das Geld folgt erst.
    expect(isApprovalTransition("L3.1")).toBe(false);
    expect(isApprovalTransition("L4")).toBe(false);
    expect(isApprovalTransition("L1")).toBe(false);
  });
});

describe("subStageFor", () => {
  const base = {
    approvedAt: null as Date | null,
    implementationCompletedAt: null as Date | null,
  };

  it("liefert null für L0, L1, L2, L5 (dort gibt es keinen Split)", () => {
    expect(subStageFor({ ...base, stageGate: "L0" })).toBeNull();
    expect(subStageFor({ ...base, stageGate: "L1" })).toBeNull();
    // Auf L2 zu stehen *ist* „BC in Arbeit" — kein Sub-Stage mehr.
    expect(subStageFor({ ...base, stageGate: "L2" })).toBeNull();
    expect(subStageFor({ ...base, stageGate: "L5" })).toBeNull();
  });

  it("L3 ohne Investitions-Abnahme → L3.1 (BC freigegeben)", () => {
    expect(subStageFor({ ...base, stageGate: "L3" })).toBe("L3.1");
  });

  it("L3 + abgenommene Investition → L3.2 (Budget alloziert)", () => {
    expect(subStageFor({ ...base, stageGate: "L3", approvedAt: new Date("2026-05-01") })).toBe(
      "L3.2",
    );
  });

  it("L4 ohne Bestätigung → L4.1 (Umsetzung läuft)", () => {
    expect(subStageFor({ ...base, stageGate: "L4" })).toBe("L4.1");
  });

  it("L4 + abgenommene L4.2-Bestätigung → L4.2 (Umsetzung fertig)", () => {
    expect(
      subStageFor({
        ...base,
        stageGate: "L4",
        implementationCompletedAt: new Date("2026-07-01"),
      }),
    ).toBe("L4.2");
  });

  it("der Investitions-Stempel wirkt nur innerhalb von L3", () => {
    expect(
      subStageFor({ ...base, stageGate: "L2", approvedAt: new Date("2026-05-01") }),
    ).toBeNull();
  });
});

describe("Gate-Steps (L3.2 und L4.2 als eigene Schritte)", () => {
  const at = new Date("2026-07-01");

  it("die Leiter enthält L3.2 und L4.2 an ihrer Stelle", () => {
    expect(GATE_STEPS).toEqual(["L0", "L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"]);
  });

  it("erlaubt L3.1 ↔ L3.2 ↔ L4, aber nicht L3.1 → L4 direkt", () => {
    expect(isValidStepTransition("L3.1", "L3.2")).toBe(true);
    expect(isValidStepTransition("L3.2", "L4")).toBe(true);
    expect(isValidStepTransition("L4", "L3.2")).toBe(true);
    expect(isValidStepTransition("L3.1", "L4")).toBe(false);
  });

  it("erlaubt L4 ↔ L4.2 ↔ L5, aber nicht L4 → L5 direkt", () => {
    expect(isValidStepTransition("L4", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4.2", "L5")).toBe(true);
    expect(isValidStepTransition("L5", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4", "L5")).toBe(false);
  });

  it("gateOfStep: die zweiten Schritte leben in ihrem Haupt-Gate", () => {
    expect(gateOfStep("L3.1")).toBe("L3");
    expect(gateOfStep("L3.2")).toBe("L3");
    expect(gateOfStep("L4.2")).toBe("L4");
  });

  it("currentGateStep: erst der jeweilige Stempel hebt auf den zweiten Schritt", () => {
    const none = { approvedAt: null, implementationCompletedAt: null };
    expect(currentGateStep({ ...none, stageGate: "L3" })).toBe("L3.1");
    expect(currentGateStep({ ...none, stageGate: "L3", approvedAt: at })).toBe("L3.2");
    expect(currentGateStep({ ...none, stageGate: "L4" })).toBe("L4");
    expect(currentGateStep({ ...none, stageGate: "L4", implementationCompletedAt: at })).toBe(
      "L4.2",
    );
    // Die Stempel wirken nur in ihrem eigenen Gate.
    expect(currentGateStep({ ...none, stageGate: "L3", implementationCompletedAt: at })).toBe(
      "L3.1",
    );
    expect(currentGateStep({ ...none, stageGate: "L2", approvedAt: at })).toBe("L2");
  });
});
