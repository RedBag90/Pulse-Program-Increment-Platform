import type { StageGate } from "@/modules/core/kernel/domain/types";
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
  /**
   * Reifegrad des Epics. Die Hypothesen-Sperre haengt daran und nicht mehr an
   * der Phase: die Hypothese wird mit dem Schritt auf L1 freigegeben.
   */
  stageGate: StageGate;
  /** Ein offener Reifegrad-Antrag sperrt den Text, ueber den entschieden wird. */
  hasOpenGateRequest: boolean;
  /** Der Betrachter ist Abnehmer des offenen Reifegrad-Antrags. */
  viewerIsGateApprover: boolean;
  /** A persisted Hypothesis baseline exists ⇒ an active revision is in flight. */
  hasHypoBaseline: boolean;
  /** A persisted Business-Case baseline exists ⇒ an active revision is in flight. */
  hasBcBaseline: boolean;
  /** `epic.update` on this Epic — the owner may edit the current artefacts. */
  canEdit: boolean;
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

/** Sperr-Text der Benefit-Hypothese — sie folgt dem Reifegrad-Antrag. */
const HYPO_LOCK_REQUESTED =
  "Der Wechsel auf L1 ist beantragt. Bis zur Abnahme ist die Hypothese gesperrt — " +
  "die Abnehmer sollen nicht auf einen wandernden Text schauen.";
const HYPO_LOCK_APPROVED =
  "Die Hypothese ist mit dem Schritt auf L1 freigegeben und damit gesperrt. Für " +
  "Änderungen das Epic auf L0 zurückstufen.";

/** German lock copy for the Business Case, keyed by the phase it is locked in. */
const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
  draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
  stakeholder_review: "Der Business Case ist während der laufenden Stakeholder-Freigaben gesperrt.",
  approved: "Das Epic ist freigegeben. Für Änderungen am Business Case eine neue Revision starten.",
};

export function computeEpicRevisionVisibility(
  input: EpicRevisionVisibilityInput,
): EpicRevisionVisibility {
  const {
    approvalPhase,
    stageGate,
    hasOpenGateRequest,
    viewerIsGateApprover,
    hasHypoBaseline,
    hasBcBaseline,
    canEdit,
    viewerHasOpenApproval,
  } = input;

  const bcEditable = canEdit && approvalPhase === "business_case";
  // Die Hypothese ist frei, solange das Epic auf L0 steht und niemand über sie
  // entscheidet. Ab dem gestellten Antrag ist sie gesperrt, nach der Abnahme
  // ebenfalls — eine Ablehnung gibt sie wieder frei.
  const hypoOnL0 = stageGate === "L0";
  const hypoEditable = canEdit && hypoOnL0 && !hasOpenGateRequest;

  const hypoLockReason = !canEdit
    ? undefined
    : hypoOnL0
      ? hasOpenGateRequest
        ? HYPO_LOCK_REQUESTED
        : undefined
      : HYPO_LOCK_APPROVED;
  const bcLockReason = canEdit ? BC_LOCK[approvalPhase] : undefined;

  const showHypoReviewDiff = hasHypoBaseline && hasOpenGateRequest && viewerIsGateApprover;
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
