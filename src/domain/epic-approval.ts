/**
 * Epic approval workflow — pure, no I/O.
 *
 * A sequential, multi-party gate that sits in front of an Epic's life, distinct
 * from the QS `status` field ([initiative-status.ts]) and the L0–L5 stage gate
 * ([stage-gate.ts], which stays an independent axis):
 *
 *   draft → hypothesis_review → business_case → stakeholder_review → approved
 *
 * The Epic Owner drafts, submits the Benefit Hypothesis for VMO review, then
 * (once approved) submits the Business Case and collects stakeholder approvals
 * per party plus explicit Breakdown/KPI sign-offs. This module owns the phase
 * transitions and the "is everything approved?" derivation; the service writes
 * the rows and audits each decision.
 */

import { APPROVAL_PARTIES, type ApprovalParty } from "./business-case";
import { ok, err, type Result } from "./errors";

export const APPROVAL_PHASES = [
  "draft",
  "hypothesis_review",
  "business_case",
  "stakeholder_review",
  "approved",
] as const;
export type ApprovalPhase = (typeof APPROVAL_PHASES)[number];

/** Explicit review sign-off sections gated alongside the Business Case. */
export const APPROVAL_SECTIONS = ["breakdown", "kpis"] as const;
export type ApprovalSection = (typeof APPROVAL_SECTIONS)[number];

/** Display labels for approval parties — shared by the approvals tab and the
 *  activity feed so the same "Finance" / "MGMT" wording appears everywhere. */
export const APPROVAL_PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

/** Display labels for the review sign-off sections. */
export const APPROVAL_SECTION_LABELS: Record<ApprovalSection, string> = {
  breakdown: "Breakdown",
  kpis: "KPIs",
};

/** A reviewer's decision on a single approval/sign-off row. */
export type ApprovalDecision = "approve" | "reject";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Allowed phase transitions. Rejections rebound: a returned hypothesis goes
 * back to `draft`, a rejected stakeholder approval back to `business_case`.
 */
const PHASE_TRANSITIONS: Record<ApprovalPhase, readonly ApprovalPhase[]> = {
  draft: ["hypothesis_review"],
  hypothesis_review: ["business_case", "draft"],
  business_case: ["stakeholder_review"],
  stakeholder_review: ["approved", "business_case"],
  // A new revision re-opens an approved Epic: full cycle (→ draft) or
  // business-case-only (→ business_case, hypothesis stays approved).
  approved: ["draft", "business_case"],
};

/** True when `to` is a permitted phase transition from `from`. */
export function canPhaseTransition(from: string, to: string): boolean {
  return (PHASE_TRANSITIONS[from as ApprovalPhase] ?? []).includes(to as ApprovalPhase);
}

// ---------------------------------------------------------------------------
// Workflow intents — what a caller wants to do.
//
// Before this seam existed every service action used its own `canFooBar(phase)`
// boolean + an identically-shaped conflict error. The boolean made the *guard*
// pure but the *response* was reconstructed in every caller. `nextPhaseFor`
// concentrates both: it returns the target phase (success) or a typed
// `phase_conflict` (failure), so services do `const next = nextPhaseFor(...)`
// and the error message stays consistent.
// ---------------------------------------------------------------------------

export type WorkflowIntent =
  | { kind: "submit_hypothesis" }
  | { kind: "decide_hypothesis"; decision: ApprovalDecision }
  | { kind: "configure_approvers" }
  | { kind: "submit_business_case" }
  | { kind: "decide_approval" }
  | { kind: "start_revision"; mode: RevisionMode };

/** Where a new revision restarts: full cycle (re-review hypothesis) or BC-only. */
export type RevisionMode = "full" | "business_case";
export function revisionStartPhase(mode: RevisionMode): ApprovalPhase {
  return mode === "full" ? "draft" : "business_case";
}

/**
 * Conflict shape returned by `nextPhaseFor` when an intent is illegal in the
 * current phase. Uses the generic `conflict` discriminant so services can
 * pass it straight back to the HTTP layer; the `reason` is pre-formatted.
 */
const INTENT_LABEL: Record<WorkflowIntent["kind"], string> = {
  submit_hypothesis: "die Hypothese einreichen",
  decide_hypothesis: "eine Hypothese-Entscheidung treffen",
  configure_approvers: "Approver konfigurieren",
  submit_business_case: "den Business Case einreichen",
  decide_approval: "eine Approval-Entscheidung treffen",
  start_revision: "eine neue Revision starten",
};

function conflict(intent: WorkflowIntent, current: ApprovalPhase) {
  return {
    kind: "conflict" as const,
    reason: `Epic in Phase "${current}" kann ${INTENT_LABEL[intent.kind]} nicht.`,
  };
}

/**
 * Workflow's central seam. Given the Epic's current phase and the action a
 * caller wants to perform, returns the **target phase** to write or `null`
 * when the intent should keep the phase (configure_approvers, decide_approval
 * partial decisions). Returns a `conflict` error when the intent is illegal
 * in the current phase, so services don't reinvent the conflict reason.
 *
 * Note: `decide_approval` doesn't pick the new phase here — that depends on
 * the full set of approval rows (see `isFullyApproved`). The service derives
 * the next phase from the rows; this function only validates the *eligibility*.
 */
export function nextPhaseFor(
  current: ApprovalPhase,
  intent: WorkflowIntent,
): Result<ApprovalPhase | null> {
  switch (intent.kind) {
    case "submit_hypothesis":
      if (current !== "draft") return err(conflict(intent, current));
      return ok("hypothesis_review");
    case "decide_hypothesis":
      if (current !== "hypothesis_review") return err(conflict(intent, current));
      return ok(intent.decision === "approve" ? "business_case" : "draft");
    case "configure_approvers":
      if (current !== "business_case") return err(conflict(intent, current));
      return ok(null);
    case "submit_business_case":
      if (current !== "business_case") return err(conflict(intent, current));
      return ok("stakeholder_review");
    case "decide_approval":
      if (current !== "stakeholder_review") return err(conflict(intent, current));
      return ok(null);
    case "start_revision":
      // A revision can be started from any phase that has actually begun — but
      // not from `draft`: nothing has started there.
      if (current === "draft") return err(conflict(intent, current));
      return ok(revisionStartPhase(intent.mode));
  }
}

/** The status a reviewer decision produces on its row. */
export function decisionStatus(decision: ApprovalDecision): ApprovalStatus {
  return decision === "approve" ? "approved" : "rejected";
}

/**
 * A single approval/sign-off row — the minimal shape this module reasons over
 * (mirrors the `EpicApproval` persistence model without depending on it).
 */
export interface ApprovalRecord {
  kind: "party" | "section";
  party?: ApprovalParty | null;
  section?: ApprovalSection | null;
  status: ApprovalStatus;
}

type RollupStatus = "unassigned" | "pending" | "approved" | "rejected";

function rollup(rows: ApprovalRecord[]): RollupStatus {
  if (rows.length === 0) return "unassigned";
  if (rows.some((r) => r.status === "rejected")) return "rejected";
  if (rows.every((r) => r.status === "approved")) return "approved";
  return "pending";
}

/**
 * Status of a party: `approved` only when ALL of its assigned approvers have
 * approved; `rejected` if any rejected; `unassigned` when no approver picked.
 */
export function partyStatus(approvals: ApprovalRecord[], party: ApprovalParty): RollupStatus {
  return rollup(approvals.filter((a) => a.kind === "party" && a.party === party));
}

/** Status of a review section (Breakdown / KPIs). */
export function sectionStatus(approvals: ApprovalRecord[], section: ApprovalSection): RollupStatus {
  return rollup(approvals.filter((a) => a.kind === "section" && a.section === section));
}

/** Parties the Epic Owner has configured (those with ≥1 assigned approver). */
export function configuredParties(approvals: ApprovalRecord[]): ApprovalParty[] {
  return APPROVAL_PARTIES.filter((p) => approvals.some((a) => a.kind === "party" && a.party === p));
}

/** True if any approval/sign-off row was rejected (→ rework). */
export function hasRejection(approvals: ApprovalRecord[]): boolean {
  return approvals.some((a) => a.status === "rejected");
}

/**
 * Fully approved ⇔ at least one party is configured, every configured party is
 * approved, and both review sections (Breakdown, KPIs) are signed off.
 */
export function isFullyApproved(approvals: ApprovalRecord[]): boolean {
  const parties = configuredParties(approvals);
  if (parties.length === 0) return false;
  if (!parties.every((p) => partyStatus(approvals, p) === "approved")) return false;
  return APPROVAL_SECTIONS.every((s) => sectionStatus(approvals, s) === "approved");
}
