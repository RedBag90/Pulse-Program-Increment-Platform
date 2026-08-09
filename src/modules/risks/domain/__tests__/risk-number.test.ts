import { describe, it, expect } from "vitest";
import { formatRiskNumber } from "@/modules/risks/domain/risk-number";

describe("formatRiskNumber", () => {
  it("pads to 3 by default", () => {
    expect(formatRiskNumber("R-", 1)).toBe("R-001");
    expect(formatRiskNumber("RISK-", 42)).toBe("RISK-042");
  });
  it("does not truncate numbers wider than the pad", () => {
    expect(formatRiskNumber("R-", 1234)).toBe("R-1234");
  });
  it("reformats purely from the prefix (no stored string)", () => {
    expect(formatRiskNumber("RISK-", 7)).toBe("RISK-007");
    expect(formatRiskNumber("R-", 7)).toBe("R-007");
  });
  it("honours a custom pad", () => {
    expect(formatRiskNumber("R-", 7, 2)).toBe("R-07");
  });
});
