import { describe, it, expect } from "vitest";
import {
  RISK_REVIEW_STATUSES,
  isRiskReviewStatus,
  reviewTarget,
  canReview,
} from "@/modules/risks/domain/risk-review";
import { RISK_CATEGORIES, isRiskCategory } from "@/modules/risks/domain/risk-category";

describe("risk review axis", () => {
  it("has the three statuses", () => {
    expect(RISK_REVIEW_STATUSES).toEqual(["suggested", "documented", "rejected"]);
    expect(isRiskReviewStatus("documented")).toBe(true);
    expect(isRiskReviewStatus("open")).toBe(false);
  });
  it("maps decisions to transitions", () => {
    expect(reviewTarget("accept")).toBe("documented");
    expect(reviewTarget("reject")).toBe("rejected");
  });
  it("only a suggested risk can be reviewed", () => {
    expect(canReview("suggested")).toBe(true);
    expect(canReview("documented")).toBe(false);
    expect(canReview("rejected")).toBe(false);
  });
});

describe("risk category", () => {
  it("accepts the allow-list, rejects others", () => {
    expect(RISK_CATEGORIES).toEqual(["technical", "business", "schedule", "external"]);
    for (const c of RISK_CATEGORIES) expect(isRiskCategory(c)).toBe(true);
    for (const c of ["", "tech", "Business", "risk"]) expect(isRiskCategory(c)).toBe(false);
  });
});
