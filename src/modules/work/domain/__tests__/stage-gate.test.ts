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
  it("is true only when a transition first enters L3", () => {
    expect(isApprovalTransition("L2", "L3")).toBe(true);
    expect(isApprovalTransition("L4", "L3")).toBe(true);
  });

  it("is false when leaving L3 or not touching it", () => {
    expect(isApprovalTransition("L3", "L4")).toBe(false);
    expect(isApprovalTransition("L3", "L2")).toBe(false);
    expect(isApprovalTransition("L0", "L1")).toBe(false);
  });
});

describe("subStageFor", () => {
  const base = {
    businessCase: null as unknown,
    businessCaseApprovedAt: null as Date | null,
    implementationCompletedAt: null as Date | null,
  };

  it("returns null for L0, L1, L3, L5 (no split there)", () => {
    expect(subStageFor({ ...base, stageGate: "L0" })).toBeNull();
    expect(subStageFor({ ...base, stageGate: "L1" })).toBeNull();
    expect(subStageFor({ ...base, stageGate: "L3" })).toBeNull();
    expect(subStageFor({ ...base, stageGate: "L5" })).toBeNull();
  });

  it("L2 + no BC content → null (not yet started)", () => {
    expect(subStageFor({ ...base, stageGate: "L2", businessCase: null })).toBeNull();
  });

  it("L2 + BC content + not approved → L2.1 (BC creation started)", () => {
    expect(subStageFor({ ...base, stageGate: "L2", businessCase: { description: "..." } })).toBe(
      "L2.1",
    );
  });

  it("L2 + BC approved → L2.2 (BC freigegeben)", () => {
    expect(
      subStageFor({
        ...base,
        stageGate: "L2",
        businessCase: { description: "..." },
        businessCaseApprovedAt: new Date("2026-05-01"),
      }),
    ).toBe("L2.2");
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
});

describe("Gate-Steps (L4.2 als eigener Schritt)", () => {
  it("die Leiter enthält L4.2 zwischen L4 und L5", () => {
    expect(GATE_STEPS).toEqual(["L0", "L1", "L2", "L3", "L4", "L4.2", "L5"]);
  });

  it("erlaubt L4 ↔ L4.2 ↔ L5, aber nicht L4 → L5 direkt", () => {
    expect(isValidStepTransition("L4", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4.2", "L5")).toBe(true);
    expect(isValidStepTransition("L5", "L4.2")).toBe(true);
    expect(isValidStepTransition("L4", "L5")).toBe(false);
  });

  it("gateOfStep: L4.2 lebt im Haupt-Gate L4", () => {
    expect(gateOfStep("L4.2")).toBe("L4");
    expect(gateOfStep("L3")).toBe("L3");
  });

  it("currentGateStep: erst mit der Bestätigung steht das Epic auf L4.2", () => {
    expect(currentGateStep({ stageGate: "L4", implementationCompletedAt: null })).toBe("L4");
    expect(
      currentGateStep({ stageGate: "L4", implementationCompletedAt: new Date("2026-07-01") }),
    ).toBe("L4.2");
    // Außerhalb von L4 ist der Stempel bedeutungslos.
    expect(
      currentGateStep({ stageGate: "L3", implementationCompletedAt: new Date("2026-07-01") }),
    ).toBe("L3");
  });
});
