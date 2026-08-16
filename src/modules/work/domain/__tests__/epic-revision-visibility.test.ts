import { describe, it, expect } from "vitest";
import type { ApprovalPhase } from "@/modules/work/domain/epic-approval";
import {
  computeEpicRevisionVisibility,
  type EpicRevisionVisibilityInput,
} from "@/modules/work/domain/epic-revision-visibility";

const HYPO_LOCK: Partial<Record<ApprovalPhase, string>> = {
  hypothesis_review:
    "Die Benefit-Hypothese ist zur QS beim Portfolio Manager eingereicht und währenddessen gesperrt.",
  business_case:
    "Die Hypothese ist freigegeben. Sie ist nun gesperrt — für Änderungen eine neue Revision starten.",
  stakeholder_review:
    "Die Hypothese ist freigegeben und während der Stakeholder-Freigaben gesperrt.",
  approved: "Das Epic ist freigegeben. Für Änderungen an der Hypothese eine neue Revision starten.",
};
const BC_LOCK: Partial<Record<ApprovalPhase, string>> = {
  draft: "Der Business Case wird erst bearbeitbar, sobald die Benefit-Hypothese freigegeben ist.",
  hypothesis_review:
    "Der Business Case wird bearbeitbar, sobald der Portfolio Manager die Hypothese freigibt.",
  stakeholder_review: "Der Business Case ist während der laufenden Stakeholder-Freigaben gesperrt.",
  approved: "Das Epic ist freigegeben. Für Änderungen am Business Case eine neue Revision starten.",
};

const PHASES: ApprovalPhase[] = [
  "draft",
  "hypothesis_review",
  "business_case",
  "stakeholder_review",
  "approved",
];

function make(over: Partial<EpicRevisionVisibilityInput> = {}): EpicRevisionVisibilityInput {
  return {
    approvalPhase: "draft",
    hasHypoBaseline: false,
    hasBcBaseline: false,
    canEdit: false,
    canDecideHypothesis: false,
    viewerHasOpenApproval: false,
    ...over,
  };
}

describe("computeEpicRevisionVisibility — editable flags", () => {
  it("hypoEditable only in draft (with canEdit); bcEditable only in business_case", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }));
      expect(v.hypoEditable).toBe(phase === "draft");
      expect(v.bcEditable).toBe(phase === "business_case");
    }
  });

  it("without canEdit nothing is editable", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: false }));
      expect(v.hypoEditable).toBe(false);
      expect(v.bcEditable).toBe(false);
    }
  });
});

describe("computeEpicRevisionVisibility — lock reasons", () => {
  it("emits the exact German lock copy per phase when canEdit", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }));
      expect(v.hypoLockReason).toBe(HYPO_LOCK[phase]);
      expect(v.bcLockReason).toBe(BC_LOCK[phase]);
    }
  });

  it("draft: hypothesis is unlocked, business case is locked", () => {
    const v = computeEpicRevisionVisibility(make({ approvalPhase: "draft", canEdit: true }));
    expect(v.hypoLockReason).toBeUndefined();
    expect(v.bcLockReason).toBe(BC_LOCK.draft);
  });

  it("business_case: business case is unlocked, hypothesis is locked", () => {
    const v = computeEpicRevisionVisibility(make({ approvalPhase: "business_case", canEdit: true }));
    expect(v.bcLockReason).toBeUndefined();
    expect(v.hypoLockReason).toBe(HYPO_LOCK.business_case);
  });

  it("no lock reasons at all when canEdit is false", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: false }));
      expect(v.hypoLockReason).toBeUndefined();
      expect(v.bcLockReason).toBeUndefined();
    }
  });
});

describe("computeEpicRevisionVisibility — review diffs", () => {
  it("showHypoReviewDiff needs baseline + hypothesis_review + canDecideHypothesis", () => {
    expect(
      computeEpicRevisionVisibility(
        make({
          approvalPhase: "hypothesis_review",
          hasHypoBaseline: true,
          canDecideHypothesis: true,
        }),
      ).showHypoReviewDiff,
    ).toBe(true);
    // Missing baseline
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "hypothesis_review", canDecideHypothesis: true }),
      ).showHypoReviewDiff,
    ).toBe(false);
    // Missing capability
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "hypothesis_review", hasHypoBaseline: true }),
      ).showHypoReviewDiff,
    ).toBe(false);
    // Wrong phase
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "draft", hasHypoBaseline: true, canDecideHypothesis: true }),
      ).showHypoReviewDiff,
    ).toBe(false);
  });

  it("showBcReviewDiff needs baseline + stakeholder_review + viewerHasOpenApproval", () => {
    expect(
      computeEpicRevisionVisibility(
        make({
          approvalPhase: "stakeholder_review",
          hasBcBaseline: true,
          viewerHasOpenApproval: true,
        }),
      ).showBcReviewDiff,
    ).toBe(true);
    // No open approval
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "stakeholder_review", hasBcBaseline: true }),
      ).showBcReviewDiff,
    ).toBe(false);
    // Missing baseline
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "stakeholder_review", viewerHasOpenApproval: true }),
      ).showBcReviewDiff,
    ).toBe(false);
  });
});

describe("computeEpicRevisionVisibility — owner-edit side-by-side", () => {
  it("ownerRevisionActive is canEdit && phase !== approved", () => {
    for (const phase of PHASES) {
      expect(
        computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: true }))
          .ownerRevisionActive,
      ).toBe(phase !== "approved");
      expect(
        computeEpicRevisionVisibility(make({ approvalPhase: phase, canEdit: false }))
          .ownerRevisionActive,
      ).toBe(false);
    }
  });

  it("showHypoOwnerEdit: baseline + owner revision active + not a review diff", () => {
    // draft: owner active, no review diff → owner edit shows
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "draft", hasHypoBaseline: true, canEdit: true }),
      ).showHypoOwnerEdit,
    ).toBe(true);
    // hypothesis_review with decide → review diff wins, owner edit suppressed
    const reviewing = computeEpicRevisionVisibility(
      make({
        approvalPhase: "hypothesis_review",
        hasHypoBaseline: true,
        canEdit: true,
        canDecideHypothesis: true,
      }),
    );
    expect(reviewing.showHypoReviewDiff).toBe(true);
    expect(reviewing.showHypoOwnerEdit).toBe(false);
    // approved → owner revision inactive → no owner edit
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "approved", hasHypoBaseline: true, canEdit: true }),
      ).showHypoOwnerEdit,
    ).toBe(false);
    // no baseline → no owner edit
    expect(
      computeEpicRevisionVisibility(make({ approvalPhase: "draft", canEdit: true }))
        .showHypoOwnerEdit,
    ).toBe(false);
  });

  it("showBcOwnerEdit: baseline + owner revision active + not a review diff", () => {
    // business_case: owner active, no review diff → owner edit shows
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "business_case", hasBcBaseline: true, canEdit: true }),
      ).showBcOwnerEdit,
    ).toBe(true);
    // stakeholder_review with open approval → review diff wins, owner edit suppressed
    const reviewing = computeEpicRevisionVisibility(
      make({
        approvalPhase: "stakeholder_review",
        hasBcBaseline: true,
        canEdit: true,
        viewerHasOpenApproval: true,
      }),
    );
    expect(reviewing.showBcReviewDiff).toBe(true);
    expect(reviewing.showBcOwnerEdit).toBe(false);
    // stakeholder_review WITHOUT open approval → no review diff → owner edit shows
    expect(
      computeEpicRevisionVisibility(
        make({ approvalPhase: "stakeholder_review", hasBcBaseline: true, canEdit: true }),
      ).showBcOwnerEdit,
    ).toBe(true);
  });
});

describe("computeEpicRevisionVisibility — plain view", () => {
  it("no baselines → every side-by-side flag is false across phases", () => {
    for (const phase of PHASES) {
      const v = computeEpicRevisionVisibility(
        make({ approvalPhase: phase, canEdit: true, canDecideHypothesis: true }),
      );
      expect(v.showHypoReviewDiff).toBe(false);
      expect(v.showBcReviewDiff).toBe(false);
      expect(v.showHypoOwnerEdit).toBe(false);
      expect(v.showBcOwnerEdit).toBe(false);
    }
  });
});
