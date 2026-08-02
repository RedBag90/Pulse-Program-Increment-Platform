import { describe, it, expect } from "vitest";
import { landingPathForRoles } from "@/domain/landing";
import { ROLES } from "@/domain/roles";

describe("landingPathForRoles", () => {
  it("Organisations-Tenant landet auf /my-tasks (rollen-unabhängig)", () => {
    expect(landingPathForRoles([ROLES.PORTFOLIO_MANAGER])).toBe("/my-tasks");
    expect(landingPathForRoles([ROLES.RTE])).toBe("/my-tasks");
    expect(landingPathForRoles([ROLES.VIEWER])).toBe("/my-tasks");
    expect(landingPathForRoles([ROLES.TENANT_ADMIN], undefined, "organization")).toBe("/my-tasks");
    expect(landingPathForRoles([])).toBe("/my-tasks");
  });

  it("privater Bereich (personal) landet im ersten freigeschalteten Modul (ziele)", () => {
    expect(landingPathForRoles([ROLES.TENANT_ADMIN], ["ziele"], "personal")).toBe("/ziele");
    expect(landingPathForRoles([ROLES.RTE], ["ziele"], "personal")).toBe("/ziele");
  });
});
