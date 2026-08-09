import { describe, it, expect } from "vitest";
import {
  direction,
  kpiDelta,
  kpiValueContribution,
  percentOfTargetGap,
  eurPerPercentagePoint,
} from "@/modules/core/kpi/domain/kpi-valuation";

describe("direction", () => {
  it("returns +1 when higher is better, −1 when lower is better, 0 otherwise", () => {
    expect(direction(40, 80)).toBe(1);
    expect(direction(10, 6)).toBe(-1);
    expect(direction(50, 50)).toBe(0);
    expect(direction(null, 80)).toBe(0);
    expect(direction(40, null)).toBe(0);
  });
});

describe("kpiDelta — signed improvement toward target", () => {
  it("higher-is-better (NPS): 40 → 80, current 60 ⇒ +20 pp", () => {
    expect(kpiDelta({ baseline: 40, target: 80, current: 60 })).toBe(20);
  });

  it("lower-is-better (lead time): 10 → 6, current 8 ⇒ +2 days saved", () => {
    expect(kpiDelta({ baseline: 10, target: 6, current: 8 })).toBe(2);
  });

  it("regression is negative", () => {
    expect(kpiDelta({ baseline: 40, target: 80, current: 30 })).toBe(-10);
    expect(kpiDelta({ baseline: 10, target: 6, current: 11 })).toBe(-1);
  });

  it("is zero at baseline or when any field is missing", () => {
    expect(kpiDelta({ baseline: 40, target: 80, current: 40 })).toBe(0);
    expect(kpiDelta({ baseline: null, target: 80, current: 60 })).toBe(0);
    expect(kpiDelta({ baseline: 40, target: null, current: 60 })).toBe(0);
    expect(kpiDelta({ baseline: 40, target: 80, current: null })).toBe(0);
  });
});

describe("kpiValueContribution", () => {
  it("monetises the improvement in natural units (lead-time example)", () => {
    // 10 → 6, current 8 ⇒ 2 days saved × €1,000/day = €2,000.
    expect(kpiValueContribution({ baseline: 10, target: 6, current: 8, valuePerUnit: 1000 })).toBe(
      2000,
    );
  });

  it("handles higher-is-better (NPS) with the same formula", () => {
    // 40 → 80, current 60 ⇒ 20 pp × €500/pp = €10,000.
    expect(kpiValueContribution({ baseline: 40, target: 80, current: 60, valuePerUnit: 500 })).toBe(
      10000,
    );
  });

  it("returns null when the valuation or any field is missing", () => {
    expect(
      kpiValueContribution({ baseline: 40, target: 80, current: 60, valuePerUnit: null }),
    ).toBeNull();
    expect(
      kpiValueContribution({ baseline: null, target: 80, current: 60, valuePerUnit: 500 }),
    ).toBeNull();
  });

  it("allows negative € on regression", () => {
    expect(kpiValueContribution({ baseline: 40, target: 80, current: 30, valuePerUnit: 500 })).toBe(
      -5000,
    );
  });
});

describe("percentOfTargetGap", () => {
  it("works in both directions and allows over-achievement", () => {
    expect(percentOfTargetGap({ baseline: 40, target: 80, current: 60 })).toBeCloseTo(0.5);
    expect(percentOfTargetGap({ baseline: 10, target: 6, current: 8 })).toBeCloseTo(0.5);
    expect(percentOfTargetGap({ baseline: 40, target: 80, current: 200 })).toBeCloseTo(4);
  });

  it("returns null on a zero-width band or missing fields", () => {
    expect(percentOfTargetGap({ baseline: 50, target: 50, current: 50 })).toBeNull();
    expect(percentOfTargetGap({ baseline: null, target: 80, current: 60 })).toBeNull();
  });
});

describe("eurPerPercentagePoint — equivalent to € per unit", () => {
  it("derives €/pp from €/unit and the target gap", () => {
    // 10 → 6: |gap| = 4 days. €1,000/day × 4 / 100 = €40 per 1 pp of target.
    expect(eurPerPercentagePoint({ baseline: 10, target: 6, valuePerUnit: 1000 })).toBe(40);
    // 40 → 80: |gap| = 40 pp. €500/pp × 40 / 100 = €200 per 1 pp of target.
    expect(eurPerPercentagePoint({ baseline: 40, target: 80, valuePerUnit: 500 })).toBe(200);
  });

  it("€/unit and €/pp yield the same contribution at any current value", () => {
    const baseline = 10;
    const target = 6;
    const current = 8;
    const valuePerUnit = 1000;
    const eurPerPp = eurPerPercentagePoint({ baseline, target, valuePerUnit })!;

    const contribFromUnit = kpiValueContribution({ baseline, target, current, valuePerUnit })!;
    const pp = percentOfTargetGap({ baseline, target, current })! * 100;
    const contribFromPp = pp * eurPerPp;

    expect(contribFromPp).toBeCloseTo(contribFromUnit);
  });
});
