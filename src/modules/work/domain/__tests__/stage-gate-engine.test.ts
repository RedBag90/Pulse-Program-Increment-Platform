import { describe, it, expect } from "vitest";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { decideGate, type EpicGateState } from "@/modules/work/domain/stage-gate-engine";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const ACTOR = "actor-1";

/** A minimal state at `stageGate` with everything else "not ready". */
function baseState(stageGate: StageGate, over: Partial<EpicGateState> = {}): EpicGateState {
  return {
    actorId: ACTOR,
    stageGate,
    ownerId: "owner-1",
    proposedStageGate: null,
    hypothesisApprovedAt: null,
    hasHypothesisContent: false,
    hasBusinessCaseContent: false,
    businessCaseApprovedAt: null,
    budgetAllocationSum: 0,
    childFeatureStats: { total: 0, started: 0, completed: 0 },
    selectedForDetailingAt: null,
    selectedForAnalyzingAt: null,
    implementationStartedAt: null,
    approvedAt: null,
    impactRecognizedAt: null,
    multiPartyApproval: true,
    ...over,
  };
}

describe("decideGate — triggers", () => {
  it("hypothesis_approved advances L0→L1 directly (the exception), stamping detailing", () => {
    const s = baseState("L0", { hypothesisApprovedAt: NOW });
    const d = decideGate(s, { kind: "trigger", trigger: "hypothesis_approved" }, NOW);
    expect(d.kind).toBe("advance");
    if (d.kind !== "advance") return;
    expect(d.toGate).toBe("L1");
    expect(d.stamps.stageGate).toBe("L1");
    expect(d.stamps.selectedForDetailingAt).toEqual(NOW);
    expect(d.stamps.proposedStageGate).toBeNull();
  });

  it("single-party: hypothesis content (no approval stamp) is enough for L0→L1", () => {
    const s = baseState("L0", { multiPartyApproval: false, hasHypothesisContent: true });
    expect(decideGate(s, { kind: "trigger", trigger: "hypothesis_approved" }, NOW).kind).toBe(
      "advance",
    );
  });

  it("business_case_saved SUGGESTS L2 (owner-confirmed), not advance", () => {
    const s = baseState("L1", { hasBusinessCaseContent: true });
    const d = decideGate(s, { kind: "trigger", trigger: "business_case_saved" }, NOW);
    expect(d.kind).toBe("suggest");
    if (d.kind !== "suggest") return;
    expect(d.toGate).toBe("L2");
    expect(d.stamps.proposedStageGate).toBe("L2");
    expect(d.stamps.proposedBy).toBe(ACTOR);
    expect(d.stamps.stageGate).toBeUndefined(); // stage NOT moved on suggest
  });

  it("budget_allocated needs BC approved AND Σ>0", () => {
    expect(
      decideGate(
        baseState("L2", { budgetAllocationSum: 5 }),
        { kind: "trigger", trigger: "budget_allocated" },
        NOW,
      ).kind,
    ).toBe("noop"); // BC not approved
    expect(
      decideGate(
        baseState("L2", { budgetAllocationSum: 5, businessCaseApprovedAt: NOW }),
        { kind: "trigger", trigger: "budget_allocated" },
        NOW,
      ).kind,
    ).toBe("suggest");
  });

  it("features_completed suggests L5 only when all children done", () => {
    expect(
      decideGate(
        baseState("L4", { childFeatureStats: { total: 3, started: 3, completed: 2 } }),
        { kind: "trigger", trigger: "features_completed" },
        NOW,
      ).kind,
    ).toBe("noop");
    expect(
      decideGate(
        baseState("L4", { childFeatureStats: { total: 3, started: 3, completed: 3 } }),
        { kind: "trigger", trigger: "features_completed" },
        NOW,
      ).kind,
    ).toBe("suggest");
  });

  it("a trigger only fires from its expected predecessor gate (single-step ordering)", () => {
    // BC saved while still at L0 must not skip to L2.
    const s = baseState("L0", { hasBusinessCaseContent: true });
    expect(decideGate(s, { kind: "trigger", trigger: "business_case_saved" }, NOW).kind).toBe(
      "noop",
    );
  });

  it("re-suggesting the same gate is idempotent (noop)", () => {
    const s = baseState("L1", { hasBusinessCaseContent: true, proposedStageGate: "L2" });
    expect(decideGate(s, { kind: "trigger", trigger: "business_case_saved" }, NOW).kind).toBe(
      "noop",
    );
  });
});

describe("decideGate — confirm", () => {
  it("blocks with conflict when no proposal is pending", () => {
    const d = decideGate(baseState("L1"), { kind: "confirm" }, NOW);
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.error.kind).toBe("conflict");
  });

  it("advances to the proposed gate and clears the proposal", () => {
    const s = baseState("L1", { hasBusinessCaseContent: true, proposedStageGate: "L2" });
    const d = decideGate(s, { kind: "confirm" }, NOW);
    expect(d.kind).toBe("advance");
    if (d.kind !== "advance") return;
    expect(d.toGate).toBe("L2");
    expect(d.stamps.selectedForAnalyzingAt).toEqual(NOW);
    expect(d.stamps.proposedStageGate).toBeNull();
  });

  it("blocks a stale proposal whose content precondition no longer holds", () => {
    // Proposed L5, but a feature un-completed since.
    const s = baseState("L4", {
      proposedStageGate: "L5",
      childFeatureStats: { total: 2, started: 2, completed: 1 },
    });
    const d = decideGate(s, { kind: "confirm" }, NOW);
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.error.kind).toBe("conflict");
  });

  it("entering L3 stamps the approval metadata", () => {
    const s = baseState("L2", {
      proposedStageGate: "L3",
      businessCaseApprovedAt: NOW,
      budgetAllocationSum: 10,
    });
    const d = decideGate(s, { kind: "confirm", comment: "ok" }, NOW);
    expect(d.kind).toBe("advance");
    if (d.kind !== "advance") return;
    expect(d.isApproval).toBe(true);
    expect(d.stamps.approvedBy).toBe(ACTOR);
    expect(d.stamps.approvedAt).toEqual(NOW);
  });
});

describe("decideGate — manual", () => {
  it("rejects an illegal jump with hierarchy_violation", () => {
    const d = decideGate(baseState("L0"), { kind: "manual", to: "L3" }, NOW);
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.error.kind).toBe("hierarchy_violation");
  });

  it("blocks manual L2→L3 (reserved for the budget trigger)", () => {
    const d = decideGate(baseState("L2"), { kind: "manual", to: "L3" }, NOW);
    expect(d.kind).toBe("block");
    if (d.kind !== "block") return;
    expect(d.error.kind).toBe("forbidden");
  });

  it("allows a backward correction and clears any proposal without forward stamps", () => {
    const s = baseState("L2", { proposedStageGate: "L3", selectedForAnalyzingAt: NOW });
    const d = decideGate(s, { kind: "manual", to: "L1" }, NOW);
    expect(d.kind).toBe("advance");
    if (d.kind !== "advance") return;
    expect(d.toGate).toBe("L1");
    expect(d.stamps.proposedStageGate).toBeNull();
    // Stepping back to L1 with detailing already implied — no new analyzing stamp.
    expect(d.stamps.selectedForAnalyzingAt).toBeUndefined();
  });
});
