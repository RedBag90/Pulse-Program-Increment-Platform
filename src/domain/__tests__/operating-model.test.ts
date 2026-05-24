import { describe, it, expect } from "vitest";
import {
  PRACTICES,
  DEFAULT_PRACTICES,
  OPERATING_MODEL_TEMPLATE_DEFS,
  effectivePractices,
} from "@/domain/operating-model";

describe("effectivePractices", () => {
  it("returns all-on when no model is defined (backward compatible)", () => {
    expect(effectivePractices(null)).toEqual(DEFAULT_PRACTICES);
    expect(effectivePractices(undefined)).toEqual(DEFAULT_PRACTICES);
  });

  it("treats a missing flag as on, an explicit false as off", () => {
    const flags = effectivePractices({ portfolioLevel: false });
    expect(flags.portfolioLevel).toBe(false);
    expect(flags.programLevel).toBe(true); // not specified → on
  });
});

describe("operating-model templates", () => {
  it("team_level turns every practice off", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.team_level;
    expect(PRACTICES.every((p) => practices[p] === false)).toBe(true);
  });

  it("essential_safe enables the program level but not portfolio governance", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.essential_safe;
    expect(practices.programLevel).toBe(true);
    expect(practices.portfolioLevel).toBe(false);
    expect(practices.stageGates).toBe(false);
    expect(practices.multiPartyApproval).toBe(false);
  });

  it("portfolio_safe enables every practice", () => {
    const { practices } = OPERATING_MODEL_TEMPLATE_DEFS.portfolio_safe;
    expect(PRACTICES.every((p) => practices[p] === true)).toBe(true);
  });
});
