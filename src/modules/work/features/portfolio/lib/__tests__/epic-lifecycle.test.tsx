import { describe, it, expect } from "vitest";
import {
  epicLifecycleSteps,
  LIFECYCLE_STEPS,
  type EpicLifecycleInput,
} from "@/modules/work/features/portfolio/lib/epic-lifecycle";

function input(over: Partial<EpicLifecycleInput> = {}): EpicLifecycleInput {
  return {
    selectedForDetailingAt: null,
    hypothesisApprovedAt: null,
    selectedForAnalyzingAt: null,
    businessCaseApprovedAt: null,
    backlogActual: null,
    implementationStartedAt: null,
    implementationActual: null,
    impactRecognizedAt: null,
    ...over,
  };
}

const D = new Date("2026-01-01");

describe("epicLifecycleSteps", () => {
  it("has all 9 ordered steps with descriptions", () => {
    expect(LIFECYCLE_STEPS).toHaveLength(9);
    expect(LIFECYCLE_STEPS.every((s) => s.description.length > 0)).toBe(true);
    expect(LIFECYCLE_STEPS[0]!.key).toBe("funnel");
    expect(LIFECYCLE_STEPS[8]!.key).toBe("done");
  });

  it("new Epic: Funnel done, Detailing current, rest upcoming", () => {
    const steps = epicLifecycleSteps(input());
    expect(steps[0]!.status).toBe("done"); // funnel
    expect(steps[1]!.status).toBe("current"); // detailing
    expect(steps.slice(2).every((s) => s.status === "upcoming")).toBe(true);
  });

  it("through business-case approval: first five done, Backlog current", () => {
    const steps = epicLifecycleSteps(
      input({
        selectedForDetailingAt: D,
        hypothesisApprovedAt: D,
        selectedForAnalyzingAt: D,
        businessCaseApprovedAt: D,
      }),
    );
    expect(steps.slice(0, 5).every((s) => s.status === "done")).toBe(true);
    expect(steps[5]!.key).toBe("backlog");
    expect(steps[5]!.status).toBe("current");
    expect(steps[6]!.status).toBe("upcoming");
  });

  it("all signals set: every step done, no current", () => {
    const steps = epicLifecycleSteps(
      input({
        selectedForDetailingAt: D,
        hypothesisApprovedAt: D,
        selectedForAnalyzingAt: D,
        businessCaseApprovedAt: D,
        backlogActual: "2026-02-01",
        implementationStartedAt: D,
        implementationActual: "2026-03-01",
        impactRecognizedAt: D,
      }),
    );
    expect(steps.every((s) => s.status === "done")).toBe(true);
    expect(steps.some((s) => s.status === "current")).toBe(false);
  });

  it("manual backlog actual gates the L3 step (not a timestamp)", () => {
    const withoutBacklog = epicLifecycleSteps(
      input({
        selectedForDetailingAt: D,
        hypothesisApprovedAt: D,
        selectedForAnalyzingAt: D,
        businessCaseApprovedAt: D,
        implementationStartedAt: D, // later signal set, but backlog gap → current is backlog
      }),
    );
    expect(withoutBacklog.find((s) => s.key === "backlog")!.status).toBe("current");
  });
});
