import { describe, it, expect } from "vitest";
import {
  authorize,
  authorizeResource,
  hasPermission,
  type AuthResource,
} from "@/server/auth/authorize";
import type { Principal, PrincipalScopes } from "@/server/auth/principal";
import { ROLES } from "@/domain/roles";
import type { TenantId, UserId } from "@/domain/types";
import { isErr, isOk } from "@/domain/errors";

const principal = (over: Partial<Principal> = {}): Principal => ({
  id: "u1" as UserId,
  tenantId: "t1" as TenantId,
  email: "u1@example.com",
  roles: [],
  scopes: { valueStreamIds: [], artIds: [], teamIds: [] } as PrincipalScopes,
  ...over,
});

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
    const d = authorize(
      "epic.update",
      { tenantId: "t1" },
      principal({ roles: [ROLES.TASK_OWNER] }),
    );
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

describe("authorize — own scope", () => {
  const taskOwner = principal({ roles: [ROLES.TASK_OWNER] });
  it("matches on ownerId or assigneeIds", () => {
    expect(authorize("task.edit", { ownerId: "u1" }, taskOwner).allow).toBe(true);
    expect(authorize("task.edit", { assigneeIds: ["u1"] }, taskOwner).allow).toBe(true);
    expect(authorize("task.edit", { ownerId: "someone-else" }, taskOwner).allow).toBe(false);
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
