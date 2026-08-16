import { describe, it, expect } from "vitest";
import { computeWsjf, wsjfBand, formatWsjf } from "@/domain/schemas/initiative";

describe("computeWsjf", () => {
  it("computes WSJF as cost-of-delay / job-size", () => {
    const result = computeWsjf({
      businessValue: 8,
      timeCriticality: 5,
      riskReduction: 3,
      jobSize: 8,
    });
    // CoD = 8 + 5 + 3 = 16 ; WSJF = 16 / 8 = 2
    expect(result).toBe(2);
  });

  it("rounds to 2 decimal places", () => {
    const result = computeWsjf({
      businessValue: 8,
      timeCriticality: 3,
      riskReduction: 2,
      jobSize: 3,
    });
    // CoD = 13 ; WSJF = 13 / 3 = 4.333...
    expect(result).toBe(4.33);
  });

  it("produces higher scores for smaller job sizes at equal CoD", () => {
    const small = computeWsjf({
      businessValue: 8,
      timeCriticality: 5,
      riskReduction: 3,
      jobSize: 1,
    });
    const large = computeWsjf({
      businessValue: 8,
      timeCriticality: 5,
      riskReduction: 3,
      jobSize: 20,
    });
    expect(small).toBeGreaterThan(large);
  });
});

describe("wsjfBand", () => {
  // Drumbeat thresholds (feature-detail / breakdown-network): ≥ 8 / ≥ 4.
  const drumbeat = { high: 8, medium: 4, missingLabel: "unscored" as const };
  // ART feature-list thresholds (features-list / features-overview): ≥ 5 / ≥ 2.
  const list = { high: 5, medium: 2, missingLabel: "none" as const };

  it("buckets with the Drumbeat thresholds (≥ 8 / ≥ 4)", () => {
    expect(wsjfBand(9, drumbeat)).toBe("high");
    expect(wsjfBand(8, drumbeat)).toBe("high"); // inclusive lower bound
    expect(wsjfBand(7.99, drumbeat)).toBe("medium");
    expect(wsjfBand(4, drumbeat)).toBe("medium"); // inclusive lower bound
    expect(wsjfBand(3.99, drumbeat)).toBe("low");
    expect(wsjfBand(0, drumbeat)).toBe("low"); // 0 is a real score, not missing
  });

  it("buckets with the ART feature-list thresholds (≥ 5 / ≥ 2)", () => {
    expect(wsjfBand(5, list)).toBe("high"); // inclusive lower bound
    expect(wsjfBand(4.99, list)).toBe("medium");
    expect(wsjfBand(2, list)).toBe("medium"); // inclusive lower bound
    expect(wsjfBand(1.99, list)).toBe("low");
    expect(wsjfBand(0, list)).toBe("low");
  });

  it("returns the caller's missing-score label for null", () => {
    expect(wsjfBand(null, drumbeat)).toBe("unscored");
    expect(wsjfBand(null, list)).toBe("none");
  });
});

describe("formatWsjf", () => {
  it("renders 2 decimals by default (matches computeWsjf's precision)", () => {
    expect(formatWsjf(4.33)).toBe("4.33");
    expect(formatWsjf(2)).toBe("2.00");
  });

  it("renders an em dash for a missing score", () => {
    expect(formatWsjf(null)).toBe("—");
  });

  it("honours an explicit precision", () => {
    expect(formatWsjf(4.33, 1)).toBe("4.3");
    expect(formatWsjf(4.33, 0)).toBe("4");
  });
});
