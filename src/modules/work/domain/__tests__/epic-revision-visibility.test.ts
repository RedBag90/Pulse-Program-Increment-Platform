import { describe, it, expect } from "vitest";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { ApprovalPhase } from "@/modules/work/domain/epic-approval";
import {
  computeEpicRevisionVisibility,
  type EpicRevisionVisibilityInput,
} from "@/modules/work/domain/epic-revision-visibility";

/**
 * Die Hypothesen-Sperre haengt seit dem Umbau am **Reifegrad-Antrag**, nicht mehr
 * an der Freigabe-Phase: die Abnahme des Schritts L0 → L1 *ist* die
 * Hypothesen-Freigabe. Der Business-Case-Teil bleibt phasenbasiert.
 */
const HYPO_LOCK_REQUESTED =
  "Der Wechsel auf L1 ist beantragt. Bis zur Abnahme ist die Hypothese gesperrt — " +
  "die Abnehmer sollen nicht auf einen wandernden Text schauen.";
const HYPO_LOCK_APPROVED =
  "Die Hypothese ist mit dem Schritt auf L1 freigegeben und damit gesperrt. Für " +
  "Änderungen das Epic auf L0 zurückstufen.";

const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
  draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
  stakeholder_review: "Der Business Case ist während der laufenden Stakeholder-Freigaben gesperrt.",
  approved: "Das Epic ist freigegeben. Für Änderungen am Business Case eine neue Revision starten.",
};

const PHASES: ApprovalPhase[] = ["draft", "business_case", "stakeholder_review", "approved"];
const GATES: StageGate[] = ["L0", "L1", "L2", "L3", "L4", "L5"];

function make(over: Partial<EpicRevisionVisibilityInput> = {}): EpicRevisionVisibilityInput {
  return {
    approvalPhase: "draft",
    stageGate: "L0",
    hasOpenGateRequest: false,
    viewerIsGateApprover: false,
    hasHypoBaseline: false,
    hasBcBaseline: false,
    canEdit: false,
    viewerHasOpenApproval: false,
    ...over,
  };
}

describe("computeEpicRevisionVisibility — die Hypothese folgt dem Antrag", () => {
  it("ist auf L0 frei, solange kein Antrag offen ist", () => {
    const v = computeEpicRevisionVisibility(make({ canEdit: true }));
    expect(v.hypoEditable).toBe(true);
    expect(v.hypoLockReason).toBeUndefined();
  });

  it("sperrt, sobald der L0→L1-Antrag steht", () => {
    const v = computeEpicRevisionVisibility(make({ canEdit: true, hasOpenGateRequest: true }));
    expect(v.hypoEditable).toBe(false);
    expect(v.hypoLockReason).toBe(HYPO_LOCK_REQUESTED);
  });

  it("bleibt ab L1 gesperrt — die Abnahme war die Freigabe", () => {
    for (const gate of GATES.filter((g) => g !== "L0")) {
      const v = computeEpicRevisionVisibility(make({ canEdit: true, stageGate: gate }));
      expect(v.hypoEditable, gate).toBe(false);
      expect(v.hypoLockReason, gate).toBe(HYPO_LOCK_APPROVED);
    }
  });

  it("ohne canEdit ist nichts editierbar und es gibt keinen Sperr-Hinweis", () => {
    for (const gate of GATES) {
      const v = computeEpicRevisionVisibility(make({ stageGate: gate, canEdit: false }));
      expect(v.hypoEditable).toBe(false);
      expect(v.hypoLockReason).toBeUndefined();
    }
  });
});

describe("computeEpicRevisionVisibility — der Business Case bleibt phasenbasiert", () => {
  it("ist nur in `business_case` editierbar", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }));
      expect(v.bcEditable, phase).toBe(phase === "business_case");
      expect(v.bcLockReason, phase).toBe(BC_LOCK[phase]);
    }
  });

  it("ohne canEdit kein Sperr-Hinweis", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: false }));
      expect(v.bcEditable).toBe(false);
      expect(v.bcLockReason).toBeUndefined();
    }
  });
});

describe("computeEpicRevisionVisibility — Review-Diffs", () => {
  it("showHypoReviewDiff verlangt Baseline + offenen Antrag + Abnehmer-Rolle", () => {
    const full = { hasHypoBaseline: true, hasOpenGateRequest: true, viewerIsGateApprover: true };
    expect(computeEpicRevisionVisibility(make(full)).showHypoReviewDiff).toBe(true);
    expect(
      computeEpicRevisionVisibility(make({ ...full, hasHypoBaseline: false })).showHypoReviewDiff,
    ).toBe(false);
    expect(
      computeEpicRevisionVisibility(make({ ...full, viewerIsGateApprover: false }))
        .showHypoReviewDiff,
    ).toBe(false);
    // Ohne offenen Antrag entscheidet niemand — also auch kein Review-Diff.
    expect(
      computeEpicRevisionVisibility(make({ ...full, hasOpenGateRequest: false }))
        .showHypoReviewDiff,
    ).toBe(false);
  });

  it("showBcReviewDiff verlangt Baseline + stakeholder_review + offene Abnahme", () => {
    const full = {
      approvalPhase: "stakeholder_review" as const,
      hasBcBaseline: true,
      viewerHasOpenApproval: true,
    };
    expect(computeEpicRevisionVisibility(make(full)).showBcReviewDiff).toBe(true);
    expect(
      computeEpicRevisionVisibility(make({ ...full, viewerHasOpenApproval: false }))
        .showBcReviewDiff,
    ).toBe(false);
    expect(
      computeEpicRevisionVisibility(make({ ...full, hasBcBaseline: false })).showBcReviewDiff,
    ).toBe(false);
  });
});

describe("computeEpicRevisionVisibility — Owner-Edit", () => {
  it("ownerRevisionActive ist canEdit && Phase !== approved", () => {
    for (const phase of PHASES) {
      expect(
        computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }))
          .ownerRevisionActive,
        phase,
      ).toBe(phase !== "approved");
    }
  });

  it("der Review-Diff verdrängt den Owner-Edit", () => {
    const reviewing = computeEpicRevisionVisibility(
      make({
        hasHypoBaseline: true,
        canEdit: true,
        hasOpenGateRequest: true,
        viewerIsGateApprover: true,
      }),
    );
    expect(reviewing.showHypoReviewDiff).toBe(true);
    expect(reviewing.showHypoOwnerEdit).toBe(false);

    // Ohne laufende Abnahme zeigt der Owner seinen eigenen Diff.
    expect(
      computeEpicRevisionVisibility(make({ hasHypoBaseline: true, canEdit: true }))
        .showHypoOwnerEdit,
    ).toBe(true);
  });

  it("ohne Baseline gibt es keinen einzigen Side-by-Side", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }));
      expect(v.showHypoReviewDiff).toBe(false);
      expect(v.showBcReviewDiff).toBe(false);
      expect(v.showHypoOwnerEdit).toBe(false);
      expect(v.showBcOwnerEdit).toBe(false);
    }
  });
});
