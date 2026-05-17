import { describe, it, expect } from "vitest";
import { parseBenefitHypothesis, benefitHypothesisHasContent } from "@/domain/benefit-hypothesis";

describe("parseBenefitHypothesis", () => {
  it("returns an empty hypothesis for null", () => {
    expect(parseBenefitHypothesis(null)).toEqual({ current: {}, history: [] });
  });

  it("returns an empty hypothesis for non-objects", () => {
    expect(parseBenefitHypothesis("nope")).toEqual({ current: {}, history: [] });
    expect(parseBenefitHypothesis(42)).toEqual({ current: {}, history: [] });
  });

  it("reads the versioned shape", () => {
    const raw = {
      current: { measuresHypothesis: "do X" },
      history: [{ content: {}, savedAt: "2026-01-01T00:00:00Z", savedBy: "u1" }],
    };
    expect(parseBenefitHypothesis(raw)).toEqual(raw);
  });

  it("defaults history to [] when missing or malformed", () => {
    expect(parseBenefitHypothesis({ current: { risks: ["r"] } }).history).toEqual([]);
    expect(parseBenefitHypothesis({ current: {}, history: "bad" }).history).toEqual([]);
  });

  it("treats a legacy flat object as the current version", () => {
    const result = parseBenefitHypothesis({ measuresHypothesis: "legacy" });
    expect(result.current).toEqual({ measuresHypothesis: "legacy" });
    expect(result.history).toEqual([]);
  });

  it("coerces a null current to {}", () => {
    expect(parseBenefitHypothesis({ current: null }).current).toEqual({});
  });
});

describe("benefitHypothesisHasContent", () => {
  it("is false for an empty field set", () => {
    expect(benefitHypothesisHasContent({})).toBe(false);
  });

  it("is false when strings are blank and lists are empty", () => {
    expect(benefitHypothesisHasContent({ measuresHypothesis: "   ", businessOutcomes: [] })).toBe(
      false,
    );
  });

  it("is false when list items are all blank", () => {
    expect(benefitHypothesisHasContent({ risks: ["", "  "] })).toBe(false);
  });

  it("is true when a text field has content", () => {
    expect(benefitHypothesisHasContent({ changeFromBaseline: "x" })).toBe(true);
  });

  it("is true when a list has a non-blank item", () => {
    expect(benefitHypothesisHasContent({ leadingIndicators: ["", "real"] })).toBe(true);
  });
});
