import { describe, it, expect } from "vitest";
import { featurePiConsistent } from "@/modules/work/domain/feature-pi";

describe("featurePiConsistent", () => {
  it("is consistent when the ART's Timeline equals the PI's Timeline", () => {
    expect(featurePiConsistent({ artTimelineId: "tl-1", piTimelineId: "tl-1" })).toBe(true);
  });

  it("is inconsistent when the Timelines differ", () => {
    expect(featurePiConsistent({ artTimelineId: "tl-1", piTimelineId: "tl-2" })).toBe(false);
  });

  it("is inconsistent when the ART has no Timeline", () => {
    expect(featurePiConsistent({ artTimelineId: null, piTimelineId: "tl-1" })).toBe(false);
  });

  it("is inconsistent when the PI has no Timeline (legacy unlinked PI)", () => {
    expect(featurePiConsistent({ artTimelineId: "tl-1", piTimelineId: null })).toBe(false);
  });

  it("is inconsistent when both are null (never treats null === null as a match)", () => {
    expect(featurePiConsistent({ artTimelineId: null, piTimelineId: null })).toBe(false);
  });
});
