import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Action, ScopeCheck } from "@/server/auth/policies";

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

  if (assignments.length === 0) return null;

  // All assignments for a user share the same tenantId (single-tenant per user for v1)
  const tenantId = assignments[0]!.tenantId as TenantId;
  const roles = assignments.map((a) => a.role);

  // Aggregate visibility scopes across all assignments (union).
  // If any assignment has an empty list at a level, that level is unscoped ("all").
  const scopes: PrincipalScopes = {
    valueStreamIds: assignments.some((a) => a.valueStreamIds.length === 0)
      ? []
      : [...new Set(assignments.flatMap((a) => a.valueStreamIds))],
    artIds: assignments.some((a) => a.artIds.length === 0)
      ? []
      : [...new Set(assignments.flatMap((a) => a.artIds))],
    teamIds: assignments.some((a) => a.teamIds.length === 0)
      ? []
      : [...new Set(assignments.flatMap((a) => a.teamIds))],
  };

  // Capabilities: einmalig pro Session laden. Wenn die `role_capabilities`-
  // Tabelle für den Tenant leer ist (frischer Tenant ohne Backfill), wird
  // auf die Code-`POLICIES` als Fallback zurückgegriffen — kein Lockout, kein
  // Verhaltenswechsel. `platform_admin` / `tenant_admin` brauchen die Liste
  // nicht (Fast-Path in `authorize()`), wir laden sie aber trotzdem, damit
  // das Admin-UI sinnvolle Aussagen treffen kann.
  const capabilities = await resolveCapabilities(db, tenantId, roles);

  return {
    id: user.id as UserId,
    tenantId,
    email: user.email ?? "",
    roles,
    scopes,
    capabilities,
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
