import { describe, it, expect } from "vitest";
import { landingPathForRoles } from "@/domain/landing";
import { ROLES } from "@/domain/roles";

describe("landingPathForRoles", () => {
  it("sends portfolio roles to the portfolio", () => {
    expect(landingPathForRoles([ROLES.PORTFOLIO_MANAGER])).toBe("/portfolio");
    expect(landingPathForRoles([ROLES.VALUE_STREAM_OWNER])).toBe("/portfolio");
    expect(landingPathForRoles([ROLES.EPIC_OWNER])).toBe("/portfolio");
  });

  it("sends program roles to the ARTs", () => {
    expect(landingPathForRoles([ROLES.RTE])).toBe("/structure?tab=arts");
    expect(landingPathForRoles([ROLES.FEATURE_OWNER])).toBe("/structure?tab=arts");
  });

  it("sends the read-only viewer to reporting", () => {
    expect(landingPathForRoles([ROLES.VIEWER])).toBe("/reporting/portfolio-health");
  });

  it("prefers the most senior role when several are held", () => {
    expect(landingPathForRoles([ROLES.RTE, ROLES.PORTFOLIO_MANAGER])).toBe("/portfolio");
  });

  it("defaults to the portfolio when no role matches", () => {
    expect(landingPathForRoles([])).toBe("/portfolio");
  });
});
