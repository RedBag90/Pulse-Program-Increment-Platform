import { describe, it, expect } from "vitest";
import { fulfillmentFraction, saturatedFulfillment } from "@/modules/core/kpi/domain/kpi-direction";

describe("fulfillmentFraction (raw, unclamped)", () => {
  it("NPS (40 → 80, current 60) → 0.5", () => {
    expect(fulfillmentFraction(40, 80, 60)).toBe(0.5);
  });

  it("Lead-time (10 → 6, current 8) → 0.5 (sign-aware via denominator)", () => {
    expect(fulfillmentFraction(10, 6, 8)).toBe(0.5);
  });

  it("Over-achievement is NOT clamped (current past target)", () => {
    expect(fulfillmentFraction(0, 100, 150)).toBe(1.5);
  });

  it("Regression yields negative (current worse than baseline)", () => {
    expect(fulfillmentFraction(40, 80, 30)).toBeCloseTo(-0.25);
  });

  it("null on any missing field", () => {
    expect(fulfillmentFraction(null, 80, 60)).toBeNull();
    expect(fulfillmentFraction(40, null, 60)).toBeNull();
    expect(fulfillmentFraction(40, 80, null)).toBeNull();
  });

  it("null on zero-width band", () => {
    expect(fulfillmentFraction(50, 50, 50)).toBeNull();
  });
});

describe("saturatedFulfillment (forecast math)", () => {
  it("missing measurement reads as 0", () => {
    expect(saturatedFulfillment(40, 80, null)).toBe(0);
  });

  it("zero-width band with a measurement reads as 1 (full)", () => {
    expect(saturatedFulfillment(50, 50, 75)).toBe(1);
  });

  it("negative fulfilment clamps to 0 (no negative benefit)", () => {
    expect(saturatedFulfillment(40, 80, 30)).toBe(0);
  });

  it("over-achievement is NOT clamped (over-1 allowed)", () => {
    expect(saturatedFulfillment(0, 100, 150)).toBe(1.5);
  });

  it("missing baseline/target with present measurement still reads as 0", () => {
    expect(saturatedFulfillment(null, 80, 60)).toBe(0);
    expect(saturatedFulfillment(40, null, 60)).toBe(0);
  });
});
