import type { ApprovalPhase } from "@/modules/work/domain/epic-approval";

/**
 * Pure revision-diff / lock visibility algebra for the Epic detail view.
 *
 * Given the approval phase, whether each artefact carries a persisted baseline
 * (⇒ an active revision is in flight), and the viewer's capabilities, this
 * resolves whether the Hypothesis / Business-Case editors are editable, whether
 * a review side-by-side diff is shown, whether an owner-edit side-by-side is
 * shown, and the German lock-reason copy for each artefact. No I/O, no `Date` —
 * a straight function of its inputs.
 */
export interface EpicRevisionVisibilityInput {
  approvalPhase: ApprovalPhase;
  /** A persisted Hypothesis baseline exists ⇒ an active revision is in flight. */
  hasHypoBaseline: boolean;
  /** A persisted Business-Case baseline exists ⇒ an active revision is in flight. */
  hasBcBaseline: boolean;
  /** `epic.update` on this Epic — the owner may edit the current artefacts. */
  canEdit: boolean;
  /** `epic.hypothesis.decide` — the Portfolio Manager may review the hypothesis. */
  canDecideHypothesis: boolean;
  /** The viewer owns an open (pending) approval on the active revision. */
  viewerHasOpenApproval: boolean;
}

export interface EpicRevisionVisibility {
  bcEditable: boolean;
  hypoEditable: boolean;
  showHypoReviewDiff: boolean;
  showBcReviewDiff: boolean;
  /** `canEdit && approvalPhase !== "approved"` — an owner revision is in flight. */
  ownerRevisionActive: boolean;
  showHypoOwnerEdit: boolean;
  showBcOwnerEdit: boolean;
  hypoLockReason?: string;
  bcLockReason?: string;
}

/** German lock copy for the Benefit-Hypothesis, keyed by the phase it is locked in. */
const HYPO_LOCK: Partial<Record<ApprovalPhase, string>> = {
  hypothesis_review:
    "Die Benefit-Hypothese ist zur QS beim Portfolio Manager eingereicht und währenddessen gesperrt.",
  business_case:
    "Die Hypothese ist freigegeben. Sie ist nun gesperrt — für Änderungen eine neue Revision starten.",
  stakeholder_review:
    "Die Hypothese ist freigegeben und während der Stakeholder-Freigaben gesperrt.",
  approved:
    "Das Epic ist freigegeben. Für Änderungen an der Hypothese eine neue Revision starten.",
};

/** German lock copy for the Business Case, keyed by the phase it is locked in. */
const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
  draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
  hypothesis_review:
    "Der Business Case wird bearbeitbar, sobald der Portfolio Manager die Hypothese freigibt.",
  stakeholder_review:
    "Der Business Case ist während der laufenden Stakeholder-Freigaben gesperrt.",
  approved:
    "Das Epic ist freigegeben. Für Änderungen am Business Case eine neue Revision starten.",
};

export function computeEpicRevisionVisibility(
  input: EpicRevisionVisibilityInput,
): EpicRevisionVisibility {
  const {
    approvalPhase,
    hasHypoBaseline,
    hasBcBaseline,
    canEdit,
    canDecideHypothesis,
    viewerHasOpenApproval,
  } = input;

  const bcEditable = canEdit && approvalPhase === "business_case";
  const hypoEditable = canEdit && approvalPhase === "draft";

  const hypoLockReason = canEdit ? HYPO_LOCK[approvalPhase] : undefined;
  const bcLockReason = canEdit ? BC_LOCK[approvalPhase] : undefined;

  const showHypoReviewDiff =
    hasHypoBaseline && approvalPhase === "hypothesis_review" && canDecideHypothesis;
  const showBcReviewDiff =
    hasBcBaseline && approvalPhase === "stakeholder_review" && viewerHasOpenApproval;

  const ownerRevisionActive = canEdit && approvalPhase !== "approved";
  const showHypoOwnerEdit = hasHypoBaseline && ownerRevisionActive && !showHypoReviewDiff;
  const showBcOwnerEdit = hasBcBaseline && ownerRevisionActive && !showBcReviewDiff;

  return {
    bcEditable,
    hypoEditable,
    showHypoReviewDiff,
    showBcReviewDiff,
    ownerRevisionActive,
    showHypoOwnerEdit,
    showBcOwnerEdit,
    ...(hypoLockReason !== undefined && { hypoLockReason }),
    ...(bcLockReason !== undefined && { bcLockReason }),
  };
}
