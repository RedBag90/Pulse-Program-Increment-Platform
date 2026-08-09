import { describe, it, expect } from "vitest";
import {
  riskExposure,
  bandForScore,
  MATRIX_CELLS,
  riskPositions,
  cellKey,
  type RiskLevel,
} from "@/modules/risks/domain/risk-matrix";

describe("riskExposure", () => {
  it("scores p·i (1..25)", () => {
    expect(riskExposure("very_low", "very_low").score).toBe(1);
    expect(riskExposure("very_high", "very_high").score).toBe(25);
    expect(riskExposure("medium", "high").score).toBe(12);
  });

  it("maps score to the right band (≤4 / ≤9 / ≤15 / else)", () => {
    expect(bandForScore(1)).toBe("low");
    expect(bandForScore(4)).toBe("low");
    expect(bandForScore(5)).toBe("medium");
    expect(bandForScore(9)).toBe("medium");
    expect(bandForScore(10)).toBe("high");
    expect(bandForScore(15)).toBe("high");
    expect(bandForScore(16)).toBe("critical");
    expect(bandForScore(25)).toBe("critical");
  });

  it("is the single source of truth reused by the cell table", () => {
    for (const c of MATRIX_CELLS) {
      expect(c.band).toBe(riskExposure(c.probability, c.impact).band);
    }
  });
});

describe("MATRIX_CELLS", () => {
  it("enumerates all 25 cells with unique keys", () => {
    expect(MATRIX_CELLS).toHaveLength(25);
    expect(new Set(MATRIX_CELLS.map((c) => c.key)).size).toBe(25);
  });
});

describe("riskPositions", () => {
  const inherent = { probability: "high" as RiskLevel, impact: "high" as RiskLevel };

  it("returns null everything when unscored", () => {
    const pos = riskPositions(null, []);
    expect(pos.inherent).toBeNull();
    expect(pos.current).toBeNull();
    expect(pos.trail).toEqual([]);
  });

  it("treats a partial scoring as unscored", () => {
    expect(riskPositions({ probability: "high" }, []).inherent).toBeNull();
  });

  it("inherent-only: current === inherent", () => {
    const pos = riskPositions(inherent, []);
    expect(pos.inherent?.key).toBe(cellKey("high", "high"));
    expect(pos.current?.key).toBe(cellKey("high", "high"));
    expect(pos.trail).toHaveLength(1);
  });

  it("builds a multi-hop trail; current is the last reassessment", () => {
    const pos = riskPositions(inherent, [
      { probability: "medium", impact: "high" },
      { probability: "low", impact: "medium" },
    ]);
    expect(pos.trail.map((p) => p.key)).toEqual([
      cellKey("high", "high"),
      cellKey("medium", "high"),
      cellKey("low", "medium"),
    ]);
    expect(pos.current?.key).toBe(cellKey("low", "medium"));
    expect(pos.inherent?.key).toBe(cellKey("high", "high"));
  });
});
