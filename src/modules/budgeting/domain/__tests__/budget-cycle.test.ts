import { describe, it, expect } from "vitest";
import {
  resolveWindowSize,
  nextCycle,
  DEFAULT_WINDOW_SIZE,
} from "@/modules/budgeting/domain/budget-cycle";

describe("resolveWindowSize", () => {
  it("defaults to 4 when unset", () => {
    expect(resolveWindowSize({ budgetWindowSize: null })).toBe(DEFAULT_WINDOW_SIZE);
  });
  it("clamps below the minimum and above the maximum", () => {
    expect(resolveWindowSize({ budgetWindowSize: 1 })).toBe(2);
    expect(resolveWindowSize({ budgetWindowSize: 99 })).toBe(8);
  });
  it("passes a valid size through", () => {
    expect(resolveWindowSize({ budgetWindowSize: 6 })).toBe(6);
  });
});

describe("nextCycle", () => {
  it("rolls H1 → H2 within the year", () => {
    expect(nextCycle("2026-H1")).toBe("2026-H2");
  });
  it("rolls H2 → H1 of the next year", () => {
    expect(nextCycle("2026-H2")).toBe("2027-H1");
  });
});
