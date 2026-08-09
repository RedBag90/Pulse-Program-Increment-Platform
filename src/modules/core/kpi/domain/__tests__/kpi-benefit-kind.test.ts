import { describe, it, expect } from "vitest";
import {
  BENEFIT_KINDS,
  isBenefitKind,
  benefitKindOrDefault,
} from "@/modules/core/kpi/domain/kpi-benefit-kind";

describe("kpi benefit kind", () => {
  it("exposes the two kinds", () => {
    expect(BENEFIT_KINDS).toEqual(["one_time", "recurring"]);
  });
  it("isBenefitKind guards", () => {
    expect(isBenefitKind("one_time")).toBe(true);
    expect(isBenefitKind("recurring")).toBe(true);
    expect(isBenefitKind("")).toBe(false);
    expect(isBenefitKind(null)).toBe(false);
    expect(isBenefitKind("bogus")).toBe(false);
  });
  it("benefitKindOrDefault falls back to recurring", () => {
    expect(benefitKindOrDefault("one_time")).toBe("one_time");
    expect(benefitKindOrDefault(null)).toBe("recurring");
    expect(benefitKindOrDefault("bogus")).toBe("recurring");
  });
});
