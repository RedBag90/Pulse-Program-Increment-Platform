/**
 * QA status gate for Epics and Features — pure, no I/O.
 *
 * Distinct from the L0–L5 stage gate ([stage-gate.ts]): this is the quality
 * lifecycle of the `status` field. An Epic/Feature Owner submits a `draft` for
 * review; the responsible QA role (VMO for Epics, RTE for Features) either
 * approves it or sends it back to `draft`.
 */

/** The statuses the QA gate moves an initiative through. */
export const QA_STATUSES = ["draft", "in_review", "approved"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];

/** A QA reviewer's decision on an `in_review` initiative. */
export type ReviewDecision = "approve" | "reject";

/** Allowed QA transitions: submit (draft→in_review), approve, send back. */
const QA_TRANSITIONS: Record<QaStatus, readonly QaStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: [],
};

/** True when `to` is a permitted QA transition from `from`. */
export function canQaTransition(from: string, to: string): boolean {
  return (QA_TRANSITIONS[from as QaStatus] ?? []).includes(to as QaStatus);
}

/** The target status a reviewer decision produces. */
export function decisionTarget(decision: ReviewDecision): QaStatus {
  return decision === "approve" ? "approved" : "draft";
}

// ---------------------------------------------------------------------------
// Delivery state machine — what happens after QS-Freigabe.
//
// `approved` is the seam: it terminates the QS gate above and bootstraps the
// delivery lifecycle below. The two machines never overlap on a non-terminal
// state — `draft`, `in_review` belong only to QS; `in_progress`, `blocked`,
// `completed`, `cancelled` belong only to delivery. Live code paths route
// through `decideReview` (QS side) or `setFeatureDeliveryStatus` (this side).
// ---------------------------------------------------------------------------

/** The delivery lifecycle statuses for an approved Feature. */
export const DELIVERY_STATUSES = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * Allowed delivery transitions. `cancelled` is reachable from every live state
 * (the work is abandoned); `completed` only from `in_progress` (a Feature in
 * `blocked` must resume before it can be marked done). Terminal states have no
 * outgoing edges.
 */
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  approved: ["in_progress", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

/** True when `to` is a permitted delivery transition from `from`. */
export function canDeliveryTransition(from: string, to: string): boolean {
  return (DELIVERY_TRANSITIONS[from as DeliveryStatus] ?? []).includes(to as DeliveryStatus);
}
