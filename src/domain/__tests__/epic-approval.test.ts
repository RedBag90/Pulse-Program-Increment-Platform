import { describe, it, expect } from "vitest";
import {
  canPhaseTransition,
  canSubmitHypothesis,
  canDecideHypothesis,
  canConfigureApprovers,
  canSubmitBusinessCase,
  canDecideApproval,
  canStartRevision,
  revisionStartPhase,
  decisionStatus,
  partyStatus,
  sectionStatus,
  configuredParties,
  hasRejection,
  isFullyApproved,
  type ApprovalRecord,
  type ApprovalSection,
  type ApprovalStatus,
} from "@/domain/epic-approval";
import type { ApprovalParty } from "@/domain/business-case";

const party = (p: ApprovalParty, status: ApprovalStatus): ApprovalRecord => ({
  kind: "party",
  party: p,
  status,
});
const section = (s: ApprovalSection, status: ApprovalStatus): ApprovalRecord => ({
  kind: "section",
  section: s,
  status,
});

/** A minimal fully-approved set: one party (all approved) + both sections. */
function fullSet(): ApprovalRecord[] {
  return [
    party("business_owner", "approved"),
    section("breakdown", "approved"),
    section("kpis", "approved"),
  ];
}

describe("phase transitions", () => {
  it("allows the forward path", () => {
    expect(canPhaseTransition("draft", "hypothesis_review")).toBe(true);
    expect(canPhaseTransition("hypothesis_review", "business_case")).toBe(true);
    expect(canPhaseTransition("business_case", "stakeholder_review")).toBe(true);
    expect(canPhaseTransition("stakeholder_review", "approved")).toBe(true);
  });

  it("allows rejection rebounds", () => {
    expect(canPhaseTransition("hypothesis_review", "draft")).toBe(true);
    expect(canPhaseTransition("stakeholder_review", "business_case")).toBe(true);
  });

  it("allows re-opening an approved Epic for a new revision", () => {
    expect(canPhaseTransition("approved", "draft")).toBe(true);
    expect(canPhaseTransition("approved", "business_case")).toBe(true);
  });

  it("forbids skips and illegal exits from approved", () => {
    expect(canPhaseTransition("draft", "business_case")).toBe(false);
    expect(canPhaseTransition("draft", "approved")).toBe(false);
    expect(canPhaseTransition("approved", "stakeholder_review")).toBe(false);
    expect(canPhaseTransition("hypothesis_review", "stakeholder_review")).toBe(false);
  });

  it("returns false for unknown phases", () => {
    expect(canPhaseTransition("nonsense", "approved")).toBe(false);
  });
});

describe("revisions", () => {
  it("canStartRevision only from approved", () => {
    expect(canStartRevision("approved")).toBe(true);
    expect(canStartRevision("draft")).toBe(false);
    expect(canStartRevision("stakeholder_review")).toBe(false);
  });

  it("revisionStartPhase maps the mode", () => {
    expect(revisionStartPhase("full")).toBe("draft");
    expect(revisionStartPhase("business_case")).toBe("business_case");
  });
});

describe("phase guards", () => {
  it("gate each action to its phase", () => {
    expect(canSubmitHypothesis("draft")).toBe(true);
    expect(canSubmitHypothesis("business_case")).toBe(false);
    expect(canDecideHypothesis("hypothesis_review")).toBe(true);
    expect(canConfigureApprovers("business_case")).toBe(true);
    expect(canSubmitBusinessCase("business_case")).toBe(true);
    expect(canSubmitBusinessCase("draft")).toBe(false);
    expect(canDecideApproval("stakeholder_review")).toBe(true);
    expect(canDecideApproval("business_case")).toBe(false);
  });
});

describe("decisionStatus", () => {
  it("maps the decision to a row status", () => {
    expect(decisionStatus("approve")).toBe("approved");
    expect(decisionStatus("reject")).toBe("rejected");
  });
});

describe("partyStatus — all assigned approvers must approve", () => {
  it("is unassigned when no approver is picked", () => {
    expect(partyStatus([], "finance")).toBe("unassigned");
  });

  it("is pending until every approver of the party approves", () => {
    const rows = [party("finance", "approved"), party("finance", "pending")];
    expect(partyStatus(rows, "finance")).toBe("pending");
  });

  it("is approved only when all of the party's approvers approve", () => {
    const rows = [party("finance", "approved"), party("finance", "approved")];
    expect(partyStatus(rows, "finance")).toBe("approved");
  });

  it("is rejected if any approver rejects", () => {
    const rows = [party("finance", "approved"), party("finance", "rejected")];
    expect(partyStatus(rows, "finance")).toBe("rejected");
  });
});

describe("sectionStatus", () => {
  it("tracks breakdown/kpis sign-off", () => {
    expect(sectionStatus([section("breakdown", "approved")], "breakdown")).toBe("approved");
    expect(sectionStatus([], "kpis")).toBe("unassigned");
    expect(sectionStatus([section("kpis", "rejected")], "kpis")).toBe("rejected");
  });
});

describe("configuredParties", () => {
  it("lists only parties with assigned approvers", () => {
    const rows = [party("business_owner", "pending"), party("finance", "approved")];
    expect(configuredParties(rows).sort()).toEqual(["business_owner", "finance"]);
  });
});

describe("hasRejection", () => {
  it("detects any rejected row", () => {
    expect(hasRejection(fullSet())).toBe(false);
    expect(hasRejection([...fullSet(), party("mgmt", "rejected")])).toBe(true);
  });
});

describe("isFullyApproved", () => {
  it("is true for one approved party plus both sections signed off", () => {
    expect(isFullyApproved(fullSet())).toBe(true);
  });

  it("is false with no parties configured", () => {
    expect(isFullyApproved([section("breakdown", "approved"), section("kpis", "approved")])).toBe(
      false,
    );
  });

  it("is false while a configured party is still pending", () => {
    const rows = [...fullSet(), party("finance", "pending")];
    expect(isFullyApproved(rows)).toBe(false);
  });

  it("is false when a review section is not signed off", () => {
    const rows = [party("business_owner", "approved"), section("breakdown", "approved")];
    expect(isFullyApproved(rows)).toBe(false);
  });

  it("is false if any row is rejected", () => {
    const rows = [...fullSet(), party("mgmt", "rejected")];
    expect(isFullyApproved(rows)).toBe(false);
  });

  it("requires every configured party (multi-party) to be approved", () => {
    const rows = [
      party("business_owner", "approved"),
      party("finance", "approved"),
      party("mgmt", "approved"),
      section("breakdown", "approved"),
      section("kpis", "approved"),
    ];
    expect(isFullyApproved(rows)).toBe(true);
  });
});
