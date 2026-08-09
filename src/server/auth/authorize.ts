import { ROLES } from "@/modules/core/kernel/domain/roles";
import { ok, err, type Result } from "@/domain/errors";
import type { Principal, PrincipalCapability } from "@/server/auth/principal";
import type { Action, ScopeCheck } from "@/server/auth/policies";

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

/**
 * "Membership or vacuous": a resource field that's `null`/missing means the
 * scope rule doesn't apply (vacuous true); an empty principal-scope list means
 * "all in reach" (also true); otherwise the resource value must be in the
 * principal's allowed list. Concentrates the pattern three of the four
 * scope checkers share.
 */
function memberOrVacuous(
  resourceField: string | null | undefined,
  principalScopes: readonly string[],
): boolean {
  if (!resourceField) return true;
  if (principalScopes.length === 0) return true;
  return principalScopes.includes(resourceField);
}

type ScopeChecker = (resource: AuthResource, principal: Principal) => boolean;

/**
 * Scope-checker registry — one entry per `ScopeCheck` variant. Adding a new
 * scope dimension (e.g. `regionId`) is a single registry entry + a field on
 * `AuthResource`, not a new arm of a growing switch. Pure functions; tested
 * by reading the entry, not by mocking the dispatch.
 */
const SCOPE_CHECKERS: Record<ScopeCheck, ScopeChecker> = {
  value_stream: (r, p) => memberOrVacuous(r.valueStreamId, p.scopes.valueStreamIds),
  art: (r, p) => memberOrVacuous(r.artId, p.scopes.artIds),
  team: (r, p) => memberOrVacuous(r.teamId, p.scopes.teamIds),
  own: (r, p) => (r.ownerId != null && r.ownerId === p.id) || (r.assigneeIds ?? []).includes(p.id),
};

function scopeSatisfied(scope: ScopeCheck, resource: AuthResource, principal: Principal): boolean {
  return SCOPE_CHECKERS[scope](resource, principal);
}

function capabilityGrants(
  capabilities: PrincipalCapability[],
  action: Action,
): PrincipalCapability[] {
  return capabilities.filter((c) => c.action === action);
}

/**
 * Central authorization decision (technical-concept §7.3). Returns an explicit
 * allow/deny with a reason so callers can produce a structured 403 rather than
 * relying on RLS returning empty results.
 *
 * `platform_admin` und `tenant_admin` sind allmächtig (Fast-Path) — sie
 * brauchen keinen Capability-Grant.
 *
 * Sonst wird gegen `principal.capabilities` geprüft (geladen in
 * `getPrincipal()` aus `role_capabilities` mit Fallback auf den Code-
 * Default in `POLICIES`). Jede Capability mit passendem `action` zählt;
 * der erste Scope-erfüllende Grant erlaubt.
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

  const grants = capabilityGrants(principal.capabilities, action);
  for (const grant of grants) {
    if (grant.scope == null) return { allow: true };
    if (scopeSatisfied(grant.scope, resource, principal)) return { allow: true };
  }

  return {
    allow: false,
    reason: `Principal ${principal.id} lacks permission for ${action}`,
  };
}

/**
 * UI-side permission predicate — answers "does this principal have the
 * capability to perform `action` on `resource`?" in one boolean, so
 * server-components and `PermissionGate` can drive `canEdit` / `canDelete`
 * affordances without re-listing roles inline.
 *
 * This DOES NOT replace server-seam authorization. Mutations still call
 * `authorize()` + `authorizeResource()` after loading the target row
 * (ADR-0002). Both paths read the same `POLICIES` registry, so the UI
 * gate and the service gate cannot drift — that's why CONTEXT.md says
 * pages should ask for a capability and never re-list roles.
 *
 * Argument order is `(principal, action, resource?)` so the most-stable
 * value comes first in call sites — matches the new pages' usage.
 */
export function hasCapability(
  principal: Principal,
  action: Action,
  resource: AuthResource = {},
): boolean {
  return authorize(action, resource, principal).allow;
}

/**
 * @deprecated Use `hasCapability(principal, action, resource?)` — argument
 * order matches the new call sites. Kept as a shim because `PermissionGate`
 * and existing tests still call it.
 */
export function hasPermission(
  action: Action,
  resource: AuthResource,
  principal: Principal,
): boolean {
  return hasCapability(principal, action, resource);
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
