import { createClient } from "@/lib/supabase/server";
import { createPrismaClient } from "@/server/db/prisma";
import type { TenantId, UserId } from "@/domain/types";

/**
 * Aggregated visibility scopes across all of a user's role assignments.
 * An empty array at any level means "all in scope" (concept §7.4).
 */
export interface PrincipalScopes {
  valueStreamIds: string[];
  artIds: string[];
  teamIds: string[];
}

export interface Principal {
  id: UserId;
  tenantId: TenantId;
  email: string;
  roles: string[];
  scopes: PrincipalScopes;
}

/**
 * Extracts the authenticated principal from the current Supabase session,
 * then resolves tenant + roles from the UserRoleAssignment table.
 * The DB is the source of truth — not JWT app_metadata.
 */
export async function getPrincipal(): Promise<Principal | null> {
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

  return {
    id: user.id as UserId,
    tenantId,
    email: user.email ?? "",
    roles,
    scopes,
  };
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
