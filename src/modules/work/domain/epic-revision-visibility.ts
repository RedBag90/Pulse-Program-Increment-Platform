import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { GateStep } from "@/modules/work/domain/stage-gate";

/**
 * Sperr- und Diff-Algebra der Epic-Detailseite — rein, ohne I/O und ohne Uhr.
 *
 * Sie beantwortet vier Fragen für Hypothese und Business Case: darf der
 * Betrachter den Text bearbeiten, sieht er als Abnehmer den Review-Diff gegen
 * die zuletzt freigegebene Fassung, sieht er als Bearbeiter die
 * Gegenüberstellung, und welcher Sperrgrund steht dran.
 *
 * Bezugsgröße ist seit dem Umbau die **Reifegrad-Achse**, nicht mehr eine
 * eigene Freigabephase: beide Texte werden mit der Abnahme des Schritts
 * freigegeben, der sie trägt (L0 → L1 die Hypothese, L2 → L3.1 der Business
 * Case). Daraus folgt die ganze Tabelle:
 *
 * | Zustand                     | Text |
 * | --------------------------- | ---- |
 * | vor dem tragenden Schritt   | offen |
 * | Antrag auf ihn gestellt     | gesperrt — die Abnehmer sollen nicht auf einen wandernden Text schauen |
 * | Schritt abgenommen          | gesperrt — für Änderungen zurückstufen |
 */
export interface EpicRevisionVisibilityInput {
  /** Reifegrad des Epics — beide Sperren hängen daran. */
  stageGate: StageGate;
  /** Ziel des offenen Reifegrad-Antrags, oder null. Sperrt genau den Text, über den entschieden wird. */
  openGateRequestTo: GateStep | null;
  /** Der Betrachter ist Abnehmer des offenen Antrags. */
  viewerIsGateApprover: boolean;
  /** Eine freigegebene Hypothesen-Fassung liegt als Baseline vor. */
  hasHypoBaseline: boolean;
  /** Eine freigegebene Business-Case-Fassung liegt als Baseline vor. */
  hasBcBaseline: boolean;
  /** `epic.update` auf diesem Epic. */
  canEdit: boolean;
}

export interface EpicRevisionVisibility {
  bcEditable: boolean;
  hypoEditable: boolean;
  showHypoReviewDiff: boolean;
  showBcReviewDiff: boolean;
  showHypoOwnerEdit: boolean;
  showBcOwnerEdit: boolean;
  hypoLockReason?: string;
  bcLockReason?: string;
}

const HYPO_LOCK_REQUESTED =
  "Der Wechsel auf L1 ist beantragt. Bis zur Abnahme ist die Hypothese gesperrt — " +
  "die Abnehmer sollen nicht auf einen wandernden Text schauen.";
const HYPO_LOCK_APPROVED =
  "Die Hypothese ist mit dem Schritt auf L1 freigegeben und damit gesperrt. Für " +
  "Änderungen das Epic auf L0 zurückstufen.";

const BC_LOCK_TOO_EARLY =
  "Der Business Case wird bearbeitbar, sobald das Epic auf L1 steht — die " +
  "Hypothese wird mit diesem Schritt freigegeben.";
const BC_LOCK_REQUESTED =
  "Der Wechsel auf L3.1 ist beantragt. Bis die fünf Parteien entschieden haben, " +
  "ist der Business Case gesperrt.";
const BC_LOCK_APPROVED =
  "Der Business Case ist mit dem Schritt auf L3.1 freigegeben und damit gesperrt. " +
  "Für Änderungen das Epic auf L2 zurückstufen.";

/** Rang des Reifegrads — nur die Grobstufe zählt, L3.1 und L3.2 liegen beide „ab L3". */
const RANK: Record<StageGate, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

export function computeEpicRevisionVisibility(
  input: EpicRevisionVisibilityInput,
): EpicRevisionVisibility {
  const {
    stageGate,
    openGateRequestTo,
    viewerIsGateApprover,
    hasHypoBaseline,
    hasBcBaseline,
    canEdit,
  } = input;

  const rank = RANK[stageGate];
  const hypoUnderReview = openGateRequestTo === "L1";
  const bcUnderReview = openGateRequestTo === "L3.1";

  // Die Hypothese ist frei, solange das Epic auf L0 steht und niemand über sie
  // entscheidet. Der Business Case ab L1 bis zu seiner Freigabe an L3.1.
  const hypoEditable = canEdit && rank === 0 && !hypoUnderReview;
  const bcEditable = canEdit && rank >= 1 && rank <= 2 && !bcUnderReview;

  const hypoLockReason = !canEdit
    ? undefined
    : rank > 0
      ? HYPO_LOCK_APPROVED
      : hypoUnderReview
        ? HYPO_LOCK_REQUESTED
        : undefined;
  const bcLockReason = !canEdit
    ? undefined
    : rank === 0
      ? BC_LOCK_TOO_EARLY
      : rank > 2
        ? BC_LOCK_APPROVED
        : bcUnderReview
          ? BC_LOCK_REQUESTED
          : undefined;

  // Der Abnehmer sieht, was sich seit der zuletzt freigegebenen Fassung geändert
  // hat — die Baseline ist der Schnappschuss, den die letzte Abnahme gezogen hat.
  const showHypoReviewDiff = hasHypoBaseline && hypoUnderReview && viewerIsGateApprover;
  const showBcReviewDiff = hasBcBaseline && bcUnderReview && viewerIsGateApprover;

  // Der Bearbeiter sieht dieselbe Gegenüberstellung, solange er schreiben darf.
  const showHypoOwnerEdit = hasHypoBaseline && hypoEditable && !showHypoReviewDiff;
  const showBcOwnerEdit = hasBcBaseline && bcEditable && !showBcReviewDiff;

  return {
    bcEditable,
    hypoEditable,
    showHypoReviewDiff,
    showBcReviewDiff,
    showHypoOwnerEdit,
    showBcOwnerEdit,
    ...(hypoLockReason !== undefined && { hypoLockReason }),
    ...(bcLockReason !== undefined && { bcLockReason }),
  };
}
