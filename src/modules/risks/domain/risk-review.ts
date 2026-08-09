/**
 * Risk review axis — the authoring workflow, independent of ROAM. A risk is
 * `suggested` (a proposal), `documented` (accepted into the register), or
 * `rejected`. ROAM/exposure apply to documented risks.
 */

export const RISK_REVIEW_STATUSES = ["suggested", "documented", "rejected"] as const;
export type RiskReviewStatus = (typeof RISK_REVIEW_STATUSES)[number];

export function isRiskReviewStatus(s: string): s is RiskReviewStatus {
  return (RISK_REVIEW_STATUSES as readonly string[]).includes(s);
}

/** A review decision on a suggestion. */
export type ReviewDecision = "accept" | "reject";

/** The only legal transitions out of `suggested`. */
export function reviewTarget(decision: ReviewDecision): RiskReviewStatus {
  return decision === "accept" ? "documented" : "rejected";
}

/** Guard: only a `suggested` risk can be reviewed. */
export function canReview(current: RiskReviewStatus): boolean {
  return current === "suggested";
}
