import { describe, it, expect } from "vitest";
import {
  parseBusinessCase,
  businessCaseHasContent,
  computeBusinessCaseTotals,
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
});

describe("businessCaseHasContent", () => {
  it("is false for an empty field set", () => {
    expect(businessCaseHasContent({})).toBe(false);
  });

  it("is false when text is blank, cost rows empty and approvals unset", () => {
    expect(
      businessCaseHasContent({
        analysisSummary: "  ",
        costRows: [{ projectType: "discovery" }],
        approvals: [{ party: "mgmt", approved: false }],
      }),
    ).toBe(false);
  });

  it("is true when a text field has content", () => {
    expect(businessCaseHasContent({ initiativeDescription: "x" })).toBe(true);
  });

  it("is true when a cost row carries a number", () => {
    expect(
      businessCaseHasContent({ costRows: [{ projectType: "impact", annualImpact: 100 }] }),
    ).toBe(true);
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
  it("returns all zeros for undefined or empty rows", () => {
    const zero = { costsMonths1to6: 0, costsMonths7to12: 0, annualImpact: 0, oneTimeEffect: 0 };
    expect(computeBusinessCaseTotals(undefined)).toEqual(zero);
    expect(computeBusinessCaseTotals([])).toEqual(zero);
  });

  it("sums each column across rows, treating missing values as 0", () => {
    const totals = computeBusinessCaseTotals([
      { projectType: "discovery", costsMonths1to6: 10, annualImpact: 5 },
      { projectType: "enabler", costsMonths1to6: 20, costsMonths7to12: 7, oneTimeEffect: 3 },
      { projectType: "impact", annualImpact: 15, oneTimeEffect: 2 },
    ]);
    expect(totals).toEqual({
      costsMonths1to6: 30,
      costsMonths7to12: 7,
      annualImpact: 20,
      oneTimeEffect: 5,
    });
  });
});
