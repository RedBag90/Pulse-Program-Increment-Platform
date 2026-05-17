import { describe, it, expect } from "vitest";
import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
  costSliceLabel,
} from "@/domain/business-case";

describe("parseBusinessCase", () => {
  it("returns an empty business case for null or non-objects", () => {
    expect(parseBusinessCase(null)).toEqual({ current: {}, history: [] });
    expect(parseBusinessCase("nope")).toEqual({ current: {}, history: [] });
  });

  it("reads the versioned shape", () => {
    const raw = {
      current: { initiativeDescription: "desc" },
      history: [{ content: {}, savedAt: "2026-01-01T00:00:00Z", savedBy: "u1" }],
    };
    expect(parseBusinessCase(raw)).toEqual(raw);
  });

  it("defaults history to [] when missing or malformed", () => {
    expect(parseBusinessCase({ current: {} }).history).toEqual([]);
    expect(parseBusinessCase({ current: {}, history: 5 }).history).toEqual([]);
  });

  it("treats a legacy flat object as the current version", () => {
    const result = parseBusinessCase({ keyStakeholders: "legacy" });
    expect(result.current).toEqual({ keyStakeholders: "legacy" });
    expect(result.history).toEqual([]);
  });

  it("coerces a null current to {}", () => {
    expect(parseBusinessCase({ current: null }).current).toEqual({});
  });

  it("migrates the legacy project-type costRows to slices and benefit fields", () => {
    const { current } = parseBusinessCase({
      current: {
        keyStakeholders: "x",
        costRows: [
          { projectType: "discovery", costsMonths1to6: 10, annualImpact: 5 },
          { projectType: "enabler", costsMonths1to6: 20, costsMonths7to12: 7, oneTimeEffect: 3 },
        ],
      },
    });
    expect(current.costSlices).toEqual([{ amount: 30 }, { amount: 7 }]);
    expect(current.oneTimeBenefit).toBe(3);
    expect(current.recurringBenefit).toBe(5);
    expect("costRows" in current).toBe(false);
    expect(current.keyStakeholders).toBe("x");
  });

  it("leaves a slice-based business case untouched", () => {
    const fields = { costSlices: [{ amount: 100 }], oneTimeBenefit: 5 };
    expect(parseBusinessCase({ current: fields }).current).toEqual(fields);
  });
});

describe("businessCaseHasContent", () => {
  it("is false for an empty field set", () => {
    expect(businessCaseHasContent({})).toBe(false);
  });

  it("is false when text is blank, slices empty and approvals unset", () => {
    expect(
      businessCaseHasContent({
        analysisSummary: "  ",
        costSlices: [{}],
        approvals: [{ party: "mgmt", approved: false }],
      }),
    ).toBe(false);
  });

  it("is true when a text field has content", () => {
    expect(businessCaseHasContent({ initiativeDescription: "x" })).toBe(true);
  });

  it("is true when a cost slice carries an amount", () => {
    expect(businessCaseHasContent({ costSlices: [{}, { amount: 100 }] })).toBe(true);
  });

  it("is true when a benefit field is set", () => {
    expect(businessCaseHasContent({ recurringBenefit: 1000 })).toBe(true);
  });

  it("is true when an approval is checked or named", () => {
    expect(businessCaseHasContent({ approvals: [{ party: "finance", approved: true }] })).toBe(
      true,
    );
    expect(
      businessCaseHasContent({
        approvals: [{ party: "finance", approved: false, approverName: "Jane" }],
      }),
    ).toBe(true);
  });
});

describe("computeBusinessCaseTotals", () => {
  it("returns zeros for an empty business case", () => {
    expect(computeBusinessCaseTotals({})).toEqual({
      implementationCost: 0,
      oneTimeBenefit: 0,
      recurringBenefit: 0,
    });
  });

  it("sums the cost slices and passes the benefit fields through", () => {
    expect(
      computeBusinessCaseTotals({
        costSlices: [{ amount: 12_000 }, { amount: 8_000 }, { amount: 4_000 }],
        oneTimeBenefit: 5_000,
        recurringBenefit: 30_000,
      }),
    ).toEqual({ implementationCost: 24_000, oneTimeBenefit: 5_000, recurringBenefit: 30_000 });
  });

  it("treats a slice with a missing amount as 0", () => {
    expect(computeBusinessCaseTotals({ costSlices: [{ amount: 10 }, {}] }).implementationCost).toBe(
      10,
    );
  });
});

describe("costSliceLabel", () => {
  it("labels each slice with its 6-month window", () => {
    expect(costSliceLabel(0)).toBe("Monate 1–6");
    expect(costSliceLabel(1)).toBe("Monate 7–12");
    expect(costSliceLabel(3)).toBe("Monate 19–24");
  });
});
