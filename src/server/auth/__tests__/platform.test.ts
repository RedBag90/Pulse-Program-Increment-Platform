import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PrincipalModule from "@/server/auth/principal";
import type { Principal, PrincipalScopes } from "@/server/auth/principal";
import { ROLES } from "@/domain/roles";
import type { TenantId, UserId } from "@/domain/types";
import { MODULE_KEYS } from "@/domain/modules";

// getPrincipal + next/navigation redirect werden für requirePlatformAdmin
// gemockt — der Guard darf sich AUSSCHLIESSLICH auf `isPlatformAdmin` stützen,
// nicht auf authorize()/tenant_admin-Fast-Path.
const getPrincipalMock = vi.fn();
const redirectMock = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/server/auth/principal", async (importOriginal) => {
  const actual = await importOriginal<typeof PrincipalModule>();
  return { ...actual, getPrincipal: () => getPrincipalMock() };
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

import { isPlatformAdmin, assertPlatformAdmin, requirePlatformAdmin } from "@/server/auth/platform";

const principal = (over: Partial<Principal> = {}): Principal => ({
  id: "u1" as UserId,
  tenantId: "t1" as TenantId,
  email: "u1@example.com",
  roles: [],
  scopes: { valueStreamIds: [], artIds: [], teamIds: [] } as PrincipalScopes,
  capabilities: [],
  tenantKind: "organization",
  tenantStatus: "active",
  enabledModules: MODULE_KEYS,
  isPlatformAdmin: false,
  ...over,
});

beforeEach(() => {
  getPrincipalMock.mockReset();
  redirectMock.mockClear();
});

describe("isPlatformAdmin — predicate", () => {
  it("true only when the flag is set", () => {
    expect(isPlatformAdmin(principal({ isPlatformAdmin: true }))).toBe(true);
    expect(isPlatformAdmin(principal({ isPlatformAdmin: false }))).toBe(false);
  });

  it("false for null", () => {
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("a tenant_admin without the global flag is NOT a platform admin", () => {
    // Kein tenant_admin-Fast-Path: die Rolle im aktiven Tenant zählt hier nicht.
    expect(isPlatformAdmin(principal({ roles: [ROLES.TENANT_ADMIN] }))).toBe(false);
  });
});

describe("assertPlatformAdmin — service seam", () => {
  it("returns the narrowed principal when admin", () => {
    const p = principal({ isPlatformAdmin: true });
    expect(assertPlatformAdmin(p)).toBe(p);
  });

  it("throws for non-admins and null", () => {
    expect(() => assertPlatformAdmin(principal({ roles: [ROLES.TENANT_ADMIN] }))).toThrow();
    expect(() => assertPlatformAdmin(null)).toThrow();
  });
});

describe("requirePlatformAdmin — layout guard", () => {
  it("returns the principal for a platform admin (no redirect)", async () => {
    getPrincipalMock.mockResolvedValue(principal({ isPlatformAdmin: true }));
    const p = await requirePlatformAdmin();
    expect(p.isPlatformAdmin).toBe(true);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a tenant_admin (blocked)", async () => {
    getPrincipalMock.mockResolvedValue(principal({ roles: [ROLES.TENANT_ADMIN] }));
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects when unauthenticated", async () => {
    getPrincipalMock.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
