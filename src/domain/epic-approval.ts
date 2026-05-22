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

/** Phase guards — what each workflow action requires. */
export function canSubmitHypothesis(phase: string): boolean {
  return phase === "draft";
}
export function canDecideHypothesis(phase: string): boolean {
  return phase === "hypothesis_review";
}
export function canConfigureApprovers(phase: string): boolean {
  return phase === "business_case";
}
export function canSubmitBusinessCase(phase: string): boolean {
  return phase === "business_case";
}
export function canDecideApproval(phase: string): boolean {
  return phase === "stakeholder_review";
}
/** A new revision can only be started from a fully approved Epic. */
export function canStartRevision(phase: string): boolean {
  return phase === "approved";
}

/** Where a new revision restarts: full cycle (re-review hypothesis) or BC-only. */
export type RevisionMode = "full" | "business_case";
export function revisionStartPhase(mode: RevisionMode): ApprovalPhase {
  return mode === "full" ? "draft" : "business_case";
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
