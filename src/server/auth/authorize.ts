import { ROLES, type Role } from "@/domain/roles";
import { ok, err, type Result } from "@/domain/errors";
import type { Principal } from "@/server/auth/principal";
import { POLICIES, type Action, type Grant, type ScopeCheck } from "@/server/auth/policies";

/**
 * The resource an action is performed against. Fields are optional — supply
 * whatever is known so scope checks can run; missing scope fields are treated
 * as "no scope restriction applies".
 */
export interface AuthResource {
  tenantId?: string;
  artId?: string | null;
  teamId?: string | null;
  valueStreamId?: string | null;
  ownerId?: string | null;
  assigneeIds?: readonly string[];
}

export interface AuthorizationDecision {
  allow: boolean;
  reason?: string;
}

function scopeSatisfied(scope: ScopeCheck, resource: AuthResource, principal: Principal): boolean {
  switch (scope) {
    case "value_stream": {
      if (!resource.valueStreamId) return true;
      const { valueStreamIds } = principal.scopes;
      return valueStreamIds.length === 0 || valueStreamIds.includes(resource.valueStreamId);
    }
    case "art": {
      if (!resource.artId) return true;
      const { artIds } = principal.scopes;
      return artIds.length === 0 || artIds.includes(resource.artId);
    }
    case "team": {
      if (!resource.teamId) return true;
      const { teamIds } = principal.scopes;
      return teamIds.length === 0 || teamIds.includes(resource.teamId);
    }
    case "own": {
      if (resource.ownerId && resource.ownerId === principal.id) return true;
      return (resource.assigneeIds ?? []).includes(principal.id);
    }
  }
}

function grantSatisfied(grant: Grant, resource: AuthResource, principal: Principal): boolean {
  const hasRole = principal.roles.some((r) => grant.roles.includes(r as Role));
  if (!hasRole) return false;
  if (grant.scope && !scopeSatisfied(grant.scope, resource, principal)) return false;
  return true;
}

/**
 * Central authorization decision (technical-concept §7.3). Returns an explicit
 * allow/deny with a reason so callers can produce a structured 403 rather than
 * relying on RLS returning empty results.
 *
 * `platform_admin` is allowed everything. Otherwise the request must satisfy
 * at least one grant in the policy registry for the action.
 */
export function authorize(
  action: Action,
  resource: AuthResource,
  principal: Principal,
): AuthorizationDecision {
  if (
    principal.roles.includes(ROLES.PLATFORM_ADMIN) ||
    principal.roles.includes(ROLES.TENANT_ADMIN)
  )
    return { allow: true };

  const grants = POLICIES[action];
  for (const grant of grants) {
    if (grantSatisfied(grant, resource, principal)) return { allow: true };
  }

  return {
    allow: false,
    reason: `Principal ${principal.id} lacks permission for ${action}`,
  };
}

/**
 * Boolean convenience wrapper for permission-aware UI (e.g. PermissionGate).
 */
export function hasPermission(
  action: Action,
  resource: AuthResource,
  principal: Principal,
): boolean {
  return authorize(action, resource, principal).allow;
}

/**
 * Service-seam authorization: the definitive, scope-aware permission check, run
 * **after** the service has loaded the target row so the resource carries its
 * real scope fields (`valueStreamId`, `artId`, `teamId`, `ownerId`). Returns a
 * `forbidden` domain error on denial so a service can `return` it directly.
 *
 * The action factory's pre-check authorizes from raw input, which lacks these
 * fields for by-id mutations — there the `value_stream`/`art`/`own` scope is
 * satisfied vacuously. This check is where scope is genuinely enforced; the
 * factory check stays as a cheap early reject. See ADR-0002.
 */
export function authorizeResource(
  principal: Principal,
  action: Action,
  resource: AuthResource,
): Result<void> {
  const decision = authorize(action, resource, principal);
  if (decision.allow) return ok(undefined);
  return err({
    kind: "forbidden" as const,
    reason: decision.reason ?? `Principal ${principal.id} lacks permission for ${action}`,
  });
}
