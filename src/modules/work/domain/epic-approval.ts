/**
 * Epic approval workflow — pure, no I/O.
 *
 * A sequential, multi-party gate that sits in front of an Epic's life, distinct
 * from the QS `status` field ([initiative-status.ts]) and the L0–L5 stage gate
 * ([stage-gate.ts], which stays an independent axis):
 *
 *   draft → hypothesis_review → business_case → stakeholder_review → approved
 *
 * The Epic Owner drafts, submits the Benefit Hypothesis for Portfolio-Manager review, then
 * (once approved) submits the Business Case and collects stakeholder approvals
 * per party plus explicit Breakdown/KPI sign-offs. This module owns the phase
 * transitions and the "is everything approved?" derivation; the service writes
 * the rows and audits each decision.
 */

import { APPROVAL_PARTIES, type ApprovalParty } from "./business-case";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import {
  type ApprovalDecision,
  type ApprovalStatus,
  type RollupStatus,
  decisionStatus,
  assertAssignedApprover,
  rollup,
} from "./approval-primitives";

// Das Freigabe-Vokabular lebt jetzt in `approval-primitives.ts`, damit die
// Reifegrad-Achse (`gate-transition.ts`) es nutzen kann, ohne die
// BC-Phasenmaschine mitzuimportieren. Hier re-exportiert, damit die
// bestehenden Aufrufstellen unverändert weiterlaufen (ADR-0003: die Achsen
// teilen Vokabular, nicht Zustand).
export type { ApprovalDecision, ApprovalStatus };
export { decisionStatus, assertAssignedApprover };

export const APPROVAL_PHASES = [
  "draft",
  "business_case",
  "stakeholder_review",
  "approved",
] as const;
export type ApprovalPhase = (typeof APPROVAL_PHASES)[number];

/** Display labels for approval parties — shared by the approvals tab and the
 *  activity feed so the same "Finance" / "MGMT" wording appears everywhere. */
export const APPROVAL_PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

/**
 * Allowed phase transitions. Rejections rebound: a returned hypothesis goes
 * back to `draft`, a rejected stakeholder approval back to `business_case`.
 */
const PHASE_TRANSITIONS: Record<ApprovalPhase, readonly ApprovalPhase[]> = {
  // draft → business_case schreibt nicht mehr dieser Apparat, sondern die
  // abgenommene Reifegrad-Transition L0 → L1: sie *ist* die Hypothesen-Freigabe.
  draft: ["business_case"],
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

/**
 * A single approval/sign-off row — the minimal shape this module reasons over
 * (mirrors the `EpicApproval` persistence model without depending on it).
 */
export interface ApprovalRecord {
  /** Nur noch "party" — die Sektions-Abnahme ist abgeschafft (s. `buildApprovalView`). */
  kind: "party";
  party?: ApprovalParty | null;
  status: ApprovalStatus;
}

/**
 * Status of a party: `approved` only when ALL of its assigned approvers have
 * approved; `rejected` if any rejected; `unassigned` when no approver picked.
 */
export function partyStatus(approvals: ApprovalRecord[], party: ApprovalParty): RollupStatus {
  return rollup(approvals.filter((a) => a.kind === "party" && a.party === party));
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
 * Fully approved ⇔ at least one party is configured and every configured party
 * is approved. Die frueheren Sektions-Abnahmen (Deliverables, KPIs) sind Teil
 * dieser einen Freigabe geworden und werden nicht mehr eigens geprueft.
 */
export function isFullyApproved(approvals: ApprovalRecord[]): boolean {
  const parties = configuredParties(approvals);
  if (parties.length === 0) return false;
  return parties.every((p) => partyStatus(approvals, p) === "approved");
}

/**
 * A submittable approver set ⇔ at least one party has an approver. The single
 * definition of "ready to go out for stakeholder review" — used as the write
 * intent by the approver config and re-verified as the read-back guard in
 * `submitBusinessCase`. Returns the pre-formatted German `reason` on failure so
 * the submit guard doesn't reinvent the message.
 */
export function isValidApproverSet(records: ApprovalRecord[]): { ok: boolean; reason?: string } {
  if (configuredParties(records).length === 0) {
    return { ok: false, reason: "Mindestens ein Approver muss konfiguriert sein" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Approval view-model — the single owner of the derivation the Business-Case
// approvals tab used to rebuild in the browser (records, per-party/per-section
// owner maps with value-stream prefill, and the overview counts). The server
// view emits it; the component renders it.
// ---------------------------------------------------------------------------

/** A raw active-revision approval row as the view-model derivation consumes it. */
export interface ApprovalViewRow {
  kind: string;
  party?: ApprovalParty | string | null;
  status: string;
  approverUserId?: string | null;
}

export interface ApprovalViewInput {
  /** The Epic's active-revision approval rows. */
  rows: readonly ApprovalViewRow[];
  /** Value-stream Finance approver — pre-fills the Finance party when unconfigured. */
  defaultFinanceApproverId?: string | null;
}

export interface ApprovalViewModel {
  /** Domain records for the active revision — feeds `partyStatus`. */
  records: ApprovalRecord[];
  /** Per-party assigned approvers (Finance prefilled from the value stream). */
  partyOwners: Record<ApprovalParty, string[]>;
  counts: {
    /** Configured parties. */
    stakeholderRows: number;
    /** Approved parties. */
    granted: number;
    /** Any row rejected → the round is blocked pending rework. */
    blocked: boolean;
    /** Parties with ≥1 assigned approver. */
    configuredPartyCount: number;
  };
}

/**
 * Pure derivation of the Business-Case approvals view from the active-revision
 * rows + the value-stream defaults. Applies the Finance prefill exactly as the
 * tab did client-side, and reuses `configuredParties`/`partyStatus`/
 * `hasRejection` for the counts.
 */
export function buildApprovalView(input: ApprovalViewInput): ApprovalViewModel {
  const { rows, defaultFinanceApproverId } = input;

  // Legacy-Zeilen der abgeschafften Sektions-Abnahme (`kind: "section"`) liegen
  // in Bestands-Datenbanken noch herum. Sie werden hier verworfen — sonst
  // wertete `hasRejection` eine alt-abgelehnte Sektionszeile weiterhin als
  // Ablehnung und hielte das Epic in Nacharbeit.
  const records: ApprovalRecord[] = rows
    .filter((r) => r.kind !== "section")
    .map((r) => ({
      kind: "party",
      party: (r.party ?? null) as ApprovalParty | null,
      status: r.status as ApprovalStatus,
    }));

  const partyOwners = {} as Record<ApprovalParty, string[]>;
  for (const p of APPROVAL_PARTIES) {
    partyOwners[p] = rows
      .filter((r) => r.kind === "party" && r.party === p && r.approverUserId)
      .map((r) => r.approverUserId as string);
  }
  // Pre-fill the Finance party from the value stream when not yet configured.
  if (partyOwners.finance.length === 0 && defaultFinanceApproverId) {
    partyOwners.finance = [defaultFinanceApproverId];
  }

  const parties = configuredParties(records);
  const granted = parties.filter((p) => partyStatus(records, p) === "approved").length;

  return {
    records,
    partyOwners,
    counts: {
      stakeholderRows: parties.length,
      granted,
      blocked: hasRejection(records),
      configuredPartyCount: parties.length,
    },
  };
}
