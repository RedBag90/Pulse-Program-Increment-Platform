import { describe, it, expect } from "vitest";
import { computeWsjf } from "@/domain/schemas/initiative";

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
