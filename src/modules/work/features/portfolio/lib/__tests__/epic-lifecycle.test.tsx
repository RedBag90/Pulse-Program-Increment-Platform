import { describe, it, expect } from "vitest";
import {
  epicLifecycleSteps,
  LIFECYCLE_STEPS,
  type EpicLifecycleInput,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";

function input(over: Partial<EpicLifecycleInput> = {}): EpicLifecycleInput {
  return {
    stageGate: "L0",
    approvalPhase: null,
    subStage: null,
    childFeatureStats: { total: 0, completed: 0 },
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

  it("L0: Funnel + Detailing done, Hypothese current (matches next-step)", () => {
    const steps = epicLifecycleSteps(input({ stageGate: "L0" }));
    expect(steps[0]!.status).toBe("done"); // funnel
    expect(steps[1]!.status).toBe("done"); // detailing (folded marker)
    expect(steps[2]!.key).toBe("hypothesis");
    expect(steps[2]!.status).toBe("current");
    expect(steps.slice(3).every((s) => s.status === "upcoming")).toBe(true);
  });

  it("L1: Business Case current (hypothesis approved, BC pending)", () => {
    expect(current({ stageGate: "L1" })).toBe("business_case");
  });

  it("L2 (BC in Arbeit): Business Case current", () => {
    expect(current({ stageGate: "L2", subStage: "L2.1" })).toBe("business_case");
  });

  it("L2.2 (BC freigegeben): Backlog current", () => {
    expect(current({ stageGate: "L2", subStage: "L2.2" })).toBe("backlog");
  });

  it("L1 approvalPhase=approved: Backlog current (defensive stale gate)", () => {
    expect(current({ stageGate: "L1", approvalPhase: "approved" })).toBe("backlog");
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
    // features in progress also drives L4.1
    expect(current({ stageGate: "L4", childFeatureStats: { total: 3, completed: 1 } })).toBe(
      "implementation_started",
    );
  });

  it("L4.2 (alle Features fertig): Umsetzung ▸ Fertig current", () => {
    expect(current({ stageGate: "L4", subStage: "L4.2" })).toBe("implementation");
    expect(current({ stageGate: "L4", childFeatureStats: { total: 3, completed: 3 } })).toBe(
      "implementation",
    );
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
