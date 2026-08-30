import { describe, it, expect } from "vitest";
import {
  canPhaseTransition,
  nextPhaseFor,
  revisionStartPhase,
  decisionStatus,
  partyStatus,
  configuredParties,
  hasRejection,
  isFullyApproved,
  isValidApproverSet,
  buildApprovalView,
  type ApprovalRecord,
  type ApprovalStatus,
} from "@/modules/work/domain/epic-approval";
import type { ApprovalParty } from "@/modules/work/domain/business-case";

const party = (p: ApprovalParty, status: ApprovalStatus): ApprovalRecord => ({
  kind: "party",
  party: p,
  status,
});
/** A minimal fully-approved set: one configured party, approved. */
function fullSet(): ApprovalRecord[] {
  return [party("business_owner", "approved")];
}

describe("phase transitions", () => {
  it("allows the forward path", () => {
    // draft → business_case schreibt die abgenommene L0→L1-Transition.
    expect(canPhaseTransition("draft", "business_case")).toBe(true);
    expect(canPhaseTransition("business_case", "stakeholder_review")).toBe(true);
    expect(canPhaseTransition("stakeholder_review", "approved")).toBe(true);
  });

  it("allows rejection rebounds", () => {
    expect(canPhaseTransition("stakeholder_review", "business_case")).toBe(true);
  });

  it("allows re-opening an approved Epic for a new revision", () => {
    expect(canPhaseTransition("approved", "draft")).toBe(true);
    expect(canPhaseTransition("approved", "business_case")).toBe(true);
  });

  it("forbids skips and illegal exits from approved", () => {
    expect(canPhaseTransition("draft", "stakeholder_review")).toBe(false);
    expect(canPhaseTransition("draft", "approved")).toBe(false);
    expect(canPhaseTransition("approved", "stakeholder_review")).toBe(false);
  });

  it("returns false for unknown phases", () => {
    expect(canPhaseTransition("nonsense", "approved")).toBe(false);
  });
});

describe("revisions", () => {
  it("revisionStartPhase maps the mode", () => {
    expect(revisionStartPhase("full")).toBe("draft");
    expect(revisionStartPhase("business_case")).toBe("business_case");
  });
});

describe("nextPhaseFor — intent-driven workflow seam", () => {
  it("configure_approvers + decide_approval keep the phase (no transition)", () => {
    const c = nextPhaseFor("business_case", { kind: "configure_approvers" });
    expect(c.ok && c.value).toBeNull();
    const d = nextPhaseFor("stakeholder_review", { kind: "decide_approval" });
    expect(d.ok && d.value).toBeNull();
  });

  it("submit_business_case from business_case → stakeholder_review", () => {
    const r = nextPhaseFor("business_case", { kind: "submit_business_case" });
    expect(r.ok && r.value).toBe("stakeholder_review");
  });

  it("start_revision from any started phase, but not from draft", () => {
    for (const phase of ["business_case", "stakeholder_review", "approved"] as const) {
      expect(nextPhaseFor(phase, { kind: "start_revision", mode: "full" }).ok).toBe(true);
    }
    expect(nextPhaseFor("draft", { kind: "start_revision", mode: "full" }).ok).toBe(false);
  });

  it("conflict reason names the current phase + the intent label", () => {
    const r = nextPhaseFor("draft", { kind: "submit_business_case" });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "conflict") {
      expect(r.error.reason).toContain('"draft"');
      expect(r.error.reason).toContain("Business Case");
    }
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
  it("is true for one approved party", () => {
    expect(isFullyApproved(fullSet())).toBe(true);
  });

  it("is false with no parties configured", () => {
    expect(isFullyApproved([])).toBe(false);
  });

  it("is false while a configured party is still pending", () => {
    const rows = [...fullSet(), party("finance", "pending")];
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
    ];
    expect(isFullyApproved(rows)).toBe(true);
  });
});

describe("isValidApproverSet — ohne Sektions-Verantwortliche", () => {
  it("genügt eine konfigurierte Partei", () => {
    expect(isValidApproverSet([party("business_owner", "pending")]).ok).toBe(true);
  });

  it("verlangt mindestens eine Partei", () => {
    const r = isValidApproverSet([]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Approver");
  });
});

describe("buildApprovalView — Legacy-Sektionszeilen", () => {
  it('verwirft alte kind:"section"-Zeilen, auch abgelehnte', () => {
    // Bestands-Datenbanken tragen die Zeilen der abgeschafften Sektions-Abnahme
    // noch. Eine abgelehnte darunter darf das Epic nicht in Nacharbeit halten.
    const view = buildApprovalView({
      rows: [
        { kind: "party", party: "business_owner", status: "approved", approverUserId: "u1" },
        { kind: "section", section: "kpis", status: "rejected", approverUserId: "u2" },
      ] as never,
    });
    expect(view.records).toHaveLength(1);
    expect(view.counts.blocked).toBe(false);
    expect(isFullyApproved(view.records)).toBe(true);
  });
});
