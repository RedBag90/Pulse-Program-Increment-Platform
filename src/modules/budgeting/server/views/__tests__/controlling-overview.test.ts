import { describe, it, expect } from "vitest";
import {
  buildControllingModel,
  isCurrentCycle,
  type ControllingModelInputs,
  type LatestRevision,
} from "@/modules/budgeting/server/views/controlling-overview";
import { DEFAULT_GUARDRAIL_TARGETS } from "@/modules/work/domain/portfolio-guardrails";
import type { BudgetPlanSnapshot } from "@/modules/budgeting/domain/budget-plan-snapshot";

/** A minimal latest-revision header. The builder only reads `cycleKey` + the
 *  numeric sums it passes through, so the snapshot is a thin cast fixture. */
function latest(over: Partial<LatestRevision> = {}): LatestRevision {
  return {
    id: "rev1",
    cycleKey: "2026-H1",
    cycleLabel: "H1 2026",
    capturedAt: new Date("2026-02-01T00:00:00.000Z"),
    capturedBy: "u1",
    epicCount: 3,
    cycleBudgetSum: 1200,
    followBudgetSum: 800,
    snapshot: {} as BudgetPlanSnapshot,
    ...over,
  };
}

function inputs(over: Partial<ControllingModelInputs> = {}): ControllingModelInputs {
  return {
    latest: null,
    history: [],
    userLabels: {},
    guardrailTargets: DEFAULT_GUARDRAIL_TARGETS,
    capabilities: { canCapture: false, canManageTargets: false },
    now: new Date("2026-08-16T00:00:00.000Z"),
    ...over,
  };
}

describe("buildControllingModel", () => {
  it("derives the active cycle key/label from the injected `now`", () => {
    const m = buildControllingModel(inputs({ now: new Date("2026-08-16T00:00:00.000Z") }));
    expect(m.cycleKey).toBe("2026-H2");
    expect(m.cycleLabel).toBe("H2 2026");
  });

  it("flags latestIsCurrentCycle when the latest revision matches the active cycle", () => {
    const now = new Date("2026-03-01T00:00:00.000Z"); // 2026-H1
    const m = buildControllingModel(inputs({ latest: latest({ cycleKey: "2026-H1" }), now }));
    expect(m.cycleKey).toBe("2026-H1");
    expect(m.latestIsCurrentCycle).toBe(true);
  });

  it("clears latestIsCurrentCycle when the latest revision is an older cycle", () => {
    const now = new Date("2026-09-01T00:00:00.000Z"); // 2026-H2
    const m = buildControllingModel(inputs({ latest: latest({ cycleKey: "2026-H1" }), now }));
    expect(m.latestIsCurrentCycle).toBe(false);
  });

  it("is never current-cycle when there is no latest revision (empty state)", () => {
    const m = buildControllingModel(inputs({ latest: null }));
    expect(m.latest).toBeNull();
    expect(m.latestIsCurrentCycle).toBe(false);
  });

  it("surfaces canCapture / canManageTargets straight from the capabilities", () => {
    const both = buildControllingModel(
      inputs({ capabilities: { canCapture: true, canManageTargets: true } }),
    );
    expect(both.canCapture).toBe(true);
    expect(both.canManageTargets).toBe(true);

    const neither = buildControllingModel(
      inputs({ capabilities: { canCapture: false, canManageTargets: false } }),
    );
    expect(neither.canCapture).toBe(false);
    expect(neither.canManageTargets).toBe(false);

    const captureOnly = buildControllingModel(
      inputs({ capabilities: { canCapture: true, canManageTargets: false } }),
    );
    expect(captureOnly.canCapture).toBe(true);
    expect(captureOnly.canManageTargets).toBe(false);
  });

  it("passes the latest revision's summarized numbers through unchanged (single source)", () => {
    const rev = latest({ cycleBudgetSum: 4200, followBudgetSum: 1500, epicCount: 7 });
    const m = buildControllingModel(inputs({ latest: rev }));
    expect(m.latest?.cycleBudgetSum).toBe(4200);
    expect(m.latest?.followBudgetSum).toBe(1500);
    expect(m.latest?.epicCount).toBe(7);
  });

  it("passes history and guardrail targets through", () => {
    const history = [latest({ id: "a" }), latest({ id: "b", cycleKey: "2025-H2" })];
    const m = buildControllingModel(inputs({ history }));
    expect(m.history).toHaveLength(2);
    expect(m.guardrailTargets).toBe(DEFAULT_GUARDRAIL_TARGETS);
  });
});

describe("isCurrentCycle", () => {
  it("matches the half-year of the injected `now`", () => {
    expect(isCurrentCycle("2026-H1", new Date("2026-01-15T00:00:00.000Z"))).toBe(true);
    expect(isCurrentCycle("2026-H1", new Date("2026-07-15T00:00:00.000Z"))).toBe(false);
    expect(isCurrentCycle("2026-H2", new Date("2026-07-15T00:00:00.000Z"))).toBe(true);
  });
});
