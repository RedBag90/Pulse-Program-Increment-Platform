import { describe, it, expect } from "vitest";
import {
  direction,
  kpiDelta,
  kpiValueContribution,
  percentOfTargetGap,
  eurPerPercentagePoint,
  kpiAttainment,
  kpiFulfillmentMean,
  kpiPlanned,
  kpiPlannedAtTarget,
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

describe("kpiAttainment — single-KPI attainment clamped to [0,1]", () => {
  it("clamps over-achievement to 1 and regression to 0", () => {
    expect(kpiAttainment({ baseline: 40, target: 80, current: 60 })).toBeCloseTo(0.5);
    expect(kpiAttainment({ baseline: 40, target: 80, current: 200 })).toBe(1); // 4× → clamp 1
    expect(kpiAttainment({ baseline: 40, target: 80, current: 20 })).toBe(0); // −0.5 → clamp 0
  });

  it("is sign-aware for lower-is-better (baseline > target)", () => {
    // lead time 10 → 6, current 8 ⇒ 0.5 attained.
    expect(kpiAttainment({ baseline: 10, target: 6, current: 8 })).toBeCloseTo(0.5);
    // current 4 (past target) → over-achieved → clamp 1.
    expect(kpiAttainment({ baseline: 10, target: 6, current: 4 })).toBe(1);
  });

  it("returns null on null current, missing field, or zero-width band", () => {
    expect(kpiAttainment({ baseline: 40, target: 80, current: null })).toBeNull();
    expect(kpiAttainment({ baseline: null, target: 80, current: 60 })).toBeNull();
    expect(kpiAttainment({ baseline: 50, target: 50, current: 50 })).toBeNull();
  });
});

describe("kpiFulfillmentMean — mean over KPIs that have data", () => {
  it("averages the attainable KPIs", () => {
    expect(
      kpiFulfillmentMean([
        { baseline: 0, target: 10, current: 5 }, // 0.5
        { baseline: 0, target: 10, current: 3 }, // 0.3
      ]),
    ).toBeCloseTo(0.4);
  });

  it("EXCLUDES null-current KPIs (no data ≠ 0 %)", () => {
    // Only the 0.5 KPI counts; the null-current one is not folded in as 0.
    expect(
      kpiFulfillmentMean([
        { baseline: 0, target: 10, current: 5 }, // 0.5
        { baseline: 0, target: 10, current: null }, // excluded
      ]),
    ).toBeCloseTo(0.5);
  });

  it("EXCLUDES zero-width-band KPIs", () => {
    expect(
      kpiFulfillmentMean([
        { baseline: 0, target: 10, current: 8 }, // 0.8
        { baseline: 50, target: 50, current: 50 }, // zero-width → excluded
      ]),
    ).toBeCloseTo(0.8);
  });

  it("returns null when none qualify (empty, or all null-current)", () => {
    expect(kpiFulfillmentMean([])).toBeNull();
    expect(kpiFulfillmentMean([{ baseline: 0, target: 10, current: null }])).toBeNull();
  });
});

describe("kpiPlannedAtTarget — raw |target−baseline| × €/unit", () => {
  it("computes the calculatoric total in both directions", () => {
    expect(kpiPlannedAtTarget({ baseline: 0, target: 10, valuePerUnit: 100 })).toBe(1000);
    expect(kpiPlannedAtTarget({ baseline: 20, target: 0, valuePerUnit: 50 })).toBe(1000); // |−20|×50
  });

  it("returns null when any field is missing", () => {
    expect(kpiPlannedAtTarget({ baseline: null, target: 10, valuePerUnit: 100 })).toBeNull();
    expect(kpiPlannedAtTarget({ baseline: 0, target: null, valuePerUnit: 100 })).toBeNull();
    expect(kpiPlannedAtTarget({ baseline: 0, target: 10, valuePerUnit: null })).toBeNull();
  });
});

describe("kpiPlanned — planned € at 100 % target (recurring annualised)", () => {
  const k = (over: Partial<Parameters<typeof kpiPlanned>[0]> = {}) => ({
    baseline: 0,
    target: 10,
    valuePerUnit: 100,
    benefitKind: "recurring",
    recurringInterval: "yearly",
    ...over,
  });

  it("one-time = the raw base", () => {
    expect(kpiPlanned(k({ benefitKind: "one_time" }))).toBe(1000);
  });

  it("recurring yearly = base, monthly = base × 12", () => {
    expect(kpiPlanned(k({ benefitKind: "recurring", recurringInterval: "yearly" }))).toBe(1000);
    expect(kpiPlanned(k({ benefitKind: "recurring", recurringInterval: "monthly" }))).toBe(12000);
  });

  it("unknown benefitKind/interval fall back to recurring/yearly defaults", () => {
    expect(kpiPlanned(k({ benefitKind: "garbage" }))).toBe(1000);
    expect(kpiPlanned(k({ recurringInterval: "garbage" }))).toBe(1000);
  });

  it("is 0 on a missing field or a zero-width base", () => {
    expect(kpiPlanned(k({ valuePerUnit: null }))).toBe(0);
    expect(kpiPlanned(k({ baseline: null }))).toBe(0);
    expect(kpiPlanned(k({ target: null }))).toBe(0);
    expect(kpiPlanned(k({ baseline: 10, target: 10 }))).toBe(0); // zero-width → 0
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
