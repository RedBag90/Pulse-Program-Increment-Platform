import { describe, it, expect } from "vitest";
import {
  STAGE_GATES,
  STAGE_GATE_TRANSITIONS,
  isValidTransition,
  isApprovalTransition,
  autoAdvanceTarget,
} from "@/domain/stage-gate";

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

describe("autoAdvanceTarget", () => {
  it("returns the target when it is strictly forward (jumps allowed)", () => {
    expect(autoAdvanceTarget("L0", "L1")).toBe("L1");
    expect(autoAdvanceTarget("L1", "L2")).toBe("L2");
    expect(autoAdvanceTarget("L1", "L3")).toBe("L3"); // workflow jump, skipping L2
    expect(autoAdvanceTarget("L0", "L3")).toBe("L3");
  });

  it("never regresses — null when the target is the same or behind", () => {
    expect(autoAdvanceTarget("L2", "L2")).toBeNull();
    expect(autoAdvanceTarget("L4", "L3")).toBeNull(); // already past the target
    expect(autoAdvanceTarget("L3", "L1")).toBeNull();
    expect(autoAdvanceTarget("L5", "L3")).toBeNull();
  });
});
