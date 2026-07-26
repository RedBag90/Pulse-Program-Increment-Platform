import { describe, it, expect } from "vitest";
import {
  authorize,
  authorizeResource,
  hasCapability,
  hasPermission,
  type AuthResource,
} from "@/server/auth/authorize";
import type { Principal, PrincipalScopes } from "@/server/auth/principal";
import { ROLES } from "@/domain/roles";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import type { TenantId, UserId } from "@/domain/types";
import { isErr, isOk } from "@/domain/errors";
import { MODULE_KEYS } from "@/domain/modules";

/**
 * Test-Principal-Factory. Mit dem RoleCapability-Modell (PR B) trägt der
 * Principal seine Capabilities selbst — die Factory leitet sie aus den
 * Default-Bundles in POLICIES ab, mirrors die Production-Fallback-Logik in
 * `resolveCapabilities()`.
 */
const principal = (over: Partial<Principal> = {}): Principal => {
  const roles = over.roles ?? [];
  const capabilities =
    over.capabilities ??
    enumerateDefaultCapabilities()
      .filter((t) => roles.includes(t.role))
      .map((t) => ({ action: t.action, scope: t.scope }));
  return {
    id: "u1" as UserId,
    tenantId: "t1" as TenantId,
    email: "u1@example.com",
    roles,
    scopes: { valueStreamIds: [], artIds: [], teamIds: [] } as PrincipalScopes,
    capabilities,
    tenantKind: "organization",
    enabledModules: MODULE_KEYS,
    ...over,
  };
};

describe("authorize — roles", () => {
  it("platform_admin and tenant_admin bypass every policy", () => {
    const r: AuthResource = { tenantId: "t1" };
    expect(authorize("epic.update", r, principal({ roles: [ROLES.PLATFORM_ADMIN] })).allow).toBe(
      true,
    );
    expect(authorize("epic.update", r, principal({ roles: [ROLES.TENANT_ADMIN] })).allow).toBe(
      true,
    );
  });

  it("denies when the principal holds no granted role", () => {
    const d = authorize("epic.update", { tenantId: "t1" }, principal({ roles: [ROLES.VIEWER] }));
    expect(d.allow).toBe(false);
    expect(d.reason).toContain("epic.update");
  });

  it("allows an unscoped role grant regardless of resource", () => {
    // EPIC_OWNER has epic.update with no scope → any Epic in the tenant.
    expect(
      authorize(
        "epic.update",
        { tenantId: "t1", valueStreamId: "vs-foreign" },
        principal({ roles: [ROLES.EPIC_OWNER] }),
      ).allow,
    ).toBe(true);
  });
});

describe("authorize — value_stream scope", () => {
  const vsOwner = (valueStreamIds: string[]) =>
    principal({
      roles: [ROLES.VALUE_STREAM_OWNER],
      scopes: { valueStreamIds, artIds: [], teamIds: [] },
    });

  it("enforces the scope when the resource carries valueStreamId", () => {
    expect(authorize("epic.update", { valueStreamId: "vs1" }, vsOwner(["vs1"])).allow).toBe(true);
    expect(authorize("epic.update", { valueStreamId: "vs2" }, vsOwner(["vs1"])).allow).toBe(false);
  });

  it("an empty principal scope means 'all in reach'", () => {
    expect(authorize("epic.update", { valueStreamId: "vs-any" }, vsOwner([])).allow).toBe(true);
  });

  it("DOCUMENTS the gap: a missing valueStreamId satisfies the scope vacuously", () => {
    // This is why by-id mutations must re-check at the service seam with the
    // loaded row's valueStreamId — see authorizeResource / ADR-0002.
    expect(authorize("epic.update", { tenantId: "t1" }, vsOwner(["vs1"])).allow).toBe(true);
  });
});

describe("authorizeResource — service-seam Result wrapper", () => {
  it("returns ok when allowed", () => {
    const r = authorizeResource(
      principal({
        roles: [ROLES.VALUE_STREAM_OWNER],
        scopes: { valueStreamIds: ["vs1"], artIds: [], teamIds: [] },
      }),
      "epic.update",
      { valueStreamId: "vs1" },
    );
    expect(isOk(r)).toBe(true);
  });

  it("returns a forbidden domain error when denied", () => {
    const r = authorizeResource(
      principal({
        roles: [ROLES.VALUE_STREAM_OWNER],
        scopes: { valueStreamIds: ["vs1"], artIds: [], teamIds: [] },
      }),
      "epic.update",
      { valueStreamId: "vs2" },
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("forbidden");
  });
});

describe("hasPermission", () => {
  it("is the boolean projection of authorize", () => {
    expect(
      hasPermission(
        "epic.update",
        { valueStreamId: "vs1" },
        principal({ roles: [ROLES.PORTFOLIO_MANAGER] }),
      ),
    ).toBe(true);
  });
});

describe("hasCapability", () => {
  it("admin bypass: tenant_admin sees every action true", () => {
    const p = principal({ roles: [ROLES.TENANT_ADMIN] });
    expect(hasCapability(p, "epic.update")).toBe(true);
    expect(hasCapability(p, "epic.delete")).toBe(true);
  });

  it("granted role without scope check returns true", () => {
    const p = principal({ roles: [ROLES.PORTFOLIO_MANAGER] });
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs1" })).toBe(true);
  });

  it("no role → false even on scope-free actions", () => {
    const p = principal({ roles: [] });
    expect(hasCapability(p, "epic.update")).toBe(false);
  });

  it("scoped grant with mismatched scope → false", () => {
    const p = principal({
      roles: [ROLES.VALUE_STREAM_OWNER],
      scopes: { valueStreamIds: ["vs-owned"], artIds: [], teamIds: [] },
    });
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs-other" })).toBe(false);
    expect(hasCapability(p, "epic.update", { valueStreamId: "vs-owned" })).toBe(true);
  });

  it("argument order is (principal, action, resource?)", () => {
    const p = principal({ roles: [ROLES.PORTFOLIO_MANAGER] });
    // The resource parameter defaults to {} — tenant-wide checks need no resource.
    expect(hasCapability(p, "epic.update")).toBe(true);
  });
});
