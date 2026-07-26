import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Action, ScopeCheck } from "@/server/auth/policies";
import { enabledModulesOrDefault, type ModuleKey } from "@/domain/modules";

/**
 * Cookie mit der aktiven Tenant-Auswahl eines Multi-Tenant-Users (Switcher).
 * Fehlt es oder zeigt es auf einen Tenant ohne Assignment, gilt das älteste
 * Assignment (das bisherige Single-Tenant-Verhalten).
 */
export const ACTIVE_TENANT_COOKIE = "pulse-tenant";

/**
 * Aggregated visibility scopes across all of a user's role assignments.
 * An empty array at any level means "all in scope" (concept §7.4).
 */
export interface PrincipalScopes {
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
}

/**
 * Eine zugewiesene Capability — Action + optionaler Scope (`value_stream`/
 * `art`/`team`/`own`). Stammt entweder aus der Tenant-spezifischen
 * `RoleCapability`-Tabelle oder dem Default-Bundle in `POLICIES`.
 */
export interface PrincipalCapability {
  action: Action;
  scope: ScopeCheck | null;
}

export interface Principal {
  id: UserId;
  tenantId: TenantId;
  email: string;
  roles: string[];
  scopes: PrincipalScopes;
  /** Resolvierte Capabilities (Vereinigung über alle Rollen des Principal). */
  capabilities: PrincipalCapability[];
  /** "organization" | "personal" — Art des aktiven Tenants. */
  tenantKind: string;
  /** Freigeschaltete Module des aktiven Tenants (Entitlement-Achse, fail-closed). */
  enabledModules: readonly ModuleKey[];
}

/** Die Assignment-Felder, die die Tenant-Auflösung braucht (Prisma-Row-Teilmenge). */
export interface AssignmentRow {
  tenantId: string;
  role: string;
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
}

/**
 * Pure Kern der Multi-Tenant-Auflösung: wählt den aktiven Tenant (gewünschter
 * Tenant, wenn dort ein Assignment existiert; sonst das älteste Assignment)
 * und aggregiert Rollen/Scopes **ausschließlich aus Assignments dieses
 * Tenants**. Vorher wurden Rollen tenant-blind über alle Tenants unioniert —
 * ein `tenant_admin` in Tenant B wäre via authorize()-Fast-Path auch in
 * Tenant A Admin gewesen (latente Privilege-Escalation).
 *
 * `assignments` müssen nach `createdAt` aufsteigend sortiert sein.
 */
export function resolveActiveAssignments(
  assignments: readonly AssignmentRow[],
  requestedTenantId: string | null,
): { tenantId: TenantId; roles: string[]; scopes: PrincipalScopes } | null {
  if (assignments.length === 0) return null;

  const tenantId = (
    requestedTenantId && assignments.some((a) => a.tenantId === requestedTenantId)
      ? requestedTenantId
      : assignments[0]!.tenantId
  ) as TenantId;

  const active = assignments.filter((a) => a.tenantId === tenantId);
  const roles = active.map((a) => a.role);

  // Sichtbarkeits-Scopes je Ebene vereinigen; ein leeres Array in irgendeinem
  // (aktiven) Assignment bedeutet „alle in Reichweite" (Konzept §7.4).
  const scopes: PrincipalScopes = {
    valueStreamIds: active.some((a) => a.valueStreamIds.length === 0)
      ? []
      : [...new Set(active.flatMap((a) => a.valueStreamIds))],
    artIds: active.some((a) => a.artIds.length === 0)
      ? []
      : [...new Set(active.flatMap((a) => a.artIds))],
    teamIds: active.some((a) => a.teamIds.length === 0)
      ? []
      : [...new Set(active.flatMap((a) => a.teamIds))],
  };

  return { tenantId, roles, scopes };
}

/**
 * Extracts the authenticated principal from the current Supabase session,
 * then resolves tenant + roles from the UserRoleAssignment table.
 * The DB is the source of truth — not JWT app_metadata.
 *
 * Per-Request memoisiert ueber React `cache()`: jeder Page-Load + jede
 * Server-Action ruft Supabase + Prisma nur einmal, danach kommt die Antwort
 * aus dem Request-Scope-Cache. Spart 2–3 DB-Roundtrips pro Action.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error ?? !user) return null;

  // Use a bootstrap client (no RLS context yet — we're establishing identity)
  const db = createPrismaClient({ userId: user.id as UserId, tenantId: "" as TenantId });

  const assignments = await db.userRoleAssignment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  // Aktive Tenant-Auswahl aus dem Switcher-Cookie; Auflösung + tenant-
  // gefilterte Rollen-/Scope-Aggregation im puren Kern (Security: keine
  // tenant-übergreifende Rollen-Union mehr).
  const cookieStore = await cookies();
  const requestedTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  const resolved = resolveActiveAssignments(assignments, requestedTenantId);
  if (!resolved) return null;
  const { tenantId, roles, scopes } = resolved;

  // Capabilities + Entitlements des aktiven Tenants parallel laden. Wenn die
  // `role_capabilities`-Tabelle für den Tenant leer ist (frischer Tenant ohne
  // Backfill), wird auf die Code-`POLICIES` als Fallback zurückgegriffen —
  // kein Lockout. `platform_admin` / `tenant_admin` brauchen die Liste nicht
  // (Fast-Path in `authorize()`), wir laden sie aber trotzdem fürs Admin-UI.
  const [capabilities, tenant] = await Promise.all([
    resolveCapabilities(db, tenantId, roles),
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { kind: true, enabledModules: true },
    }),
  ]);

  const tenantKind = tenant?.kind ?? "organization";
  const enabledModules = enabledModulesOrDefault({
    kind: tenantKind,
    enabledModules: tenant?.enabledModules ?? [],
  });

  return {
    id: user.id as UserId,
    tenantId,
    email: user.email ?? "",
    roles,
    scopes,
    capabilities,
    tenantKind,
    enabledModules,
  };
});

/**
 * Resolves the capability list for the principal. Reads `role_capabilities`
 * (the tenant's editable bundle); falls back to the in-code `POLICIES`
 * defaults when the tenant has no rows yet (fresh tenant, no backfill).
 *
 * Exported separately so test fixtures and the admin UI can use the same
 * resolution path.
 */
export async function resolveCapabilities(
  db: ReturnType<typeof createPrismaClient>,
  tenantId: TenantId,
  roles: string[],
): Promise<PrincipalCapability[]> {
  const rows = await db.roleCapability.findMany({
    where: { tenantId, role: { in: roles } },
    select: { action: true, scope: true },
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      action: r.action as Action,
      scope: (r.scope as ScopeCheck | null) ?? null,
    }));
  }

  // Fallback: tenant hat keine Backfill-Rows → Default-Bundle aus dem Code
  // verwenden. Dynamic import wegen ESLint-Regel "kein Zirkel" (policies →
  // authorize → principal sonst).
  const { enumerateDefaultCapabilities } = await import("@/server/auth/policies");
  return enumerateDefaultCapabilities()
    .filter((t) => roles.includes(t.role))
    .map((t) => ({ action: t.action, scope: t.scope }));
}

/**
 * Like getPrincipal() but throws if no session or no role assignment exists.
 */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) {
    throw new Error("Unauthenticated — middleware should have caught this");
  }
  return principal;
}
