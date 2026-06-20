import { describe, it, expect } from "vitest";
import { landingPathForRoles } from "@/domain/landing";
import { ROLES } from "@/domain/roles";

describe("landingPathForRoles", () => {
  it("sends the transformation lead to the cockpit", () => {
    expect(landingPathForRoles([ROLES.TRANSFORMATION_LEAD])).toBe("/transformation");
  });

  it("sends portfolio roles to the portfolio", () => {
    expect(landingPathForRoles([ROLES.PORTFOLIO_MANAGER])).toBe("/portfolio");
    expect(landingPathForRoles([ROLES.VMO])).toBe("/portfolio");
  });

  it("sends program roles to the ARTs", () => {
    expect(landingPathForRoles([ROLES.RTE])).toBe("/structure?tab=arts");
    expect(landingPathForRoles([ROLES.FEATURE_OWNER])).toBe("/structure?tab=arts");
  });

  it("sends the team editor to the ARTs", () => {
    expect(landingPathForRoles([ROLES.TEAM_EDITOR])).toBe("/structure?tab=arts");
  });

  it("sends the read-only viewer to reporting", () => {
    expect(landingPathForRoles([ROLES.VIEWER])).toBe("/reporting/portfolio-health");
  });

  it("prefers the most senior role when several are held", () => {
    expect(landingPathForRoles([ROLES.TEAM_EDITOR, ROLES.TRANSFORMATION_LEAD])).toBe(
      "/transformation",
    );
  });

  it("defaults to the portfolio when no role matches", () => {
    expect(landingPathForRoles([])).toBe("/portfolio");
  });
});
