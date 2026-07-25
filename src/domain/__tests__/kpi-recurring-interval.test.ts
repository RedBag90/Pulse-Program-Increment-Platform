import { describe, it, expect } from "vitest";
import {
  RECURRING_INTERVALS,
  isRecurringInterval,
  recurringIntervalOrDefault,
} from "@/domain/kpi-recurring-interval";

describe("kpi recurring interval", () => {
  it("exposes the two intervals", () => {
    expect(RECURRING_INTERVALS).toEqual(["monthly", "yearly"]);
  });
  it("isRecurringInterval guards", () => {
    expect(isRecurringInterval("monthly")).toBe(true);
    expect(isRecurringInterval("yearly")).toBe(true);
    expect(isRecurringInterval("")).toBe(false);
    expect(isRecurringInterval(null)).toBe(false);
    expect(isRecurringInterval("annual")).toBe(false);
  });
  it("recurringIntervalOrDefault falls back to yearly", () => {
    expect(recurringIntervalOrDefault("monthly")).toBe("monthly");
    expect(recurringIntervalOrDefault(null)).toBe("yearly");
    expect(recurringIntervalOrDefault("bogus")).toBe("yearly");
  });
});
