import { createClient } from "@/lib/supabase/server";
import type { TenantId, UserId } from "@/domain/types";

export interface Principal {
  id: UserId;
  tenantId: TenantId;
  email: string;
  roles: string[];
}

/**
 * Extracts the authenticated principal from the current Supabase session.
 * Returns null when no valid session exists.
 *
 * Always use `supabase.auth.getUser()` (not `getSession()`) for server-side
 * auth to ensure the token is validated against the Supabase server.
 */
export async function getPrincipal(): Promise<Principal | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error ?? !user) return null;

  const tenantId = (user.user_metadata?.["tenant_id"] ??
    user.app_metadata?.["tenant_id"] ??
    "") as string;

  const roles = (user.app_metadata?.["roles"] ?? []) as string[];

  return {
    id: user.id as UserId,
    tenantId: tenantId as TenantId,
    email: user.email ?? "",
    roles,
  };
}

/**
 * Like getPrincipal() but throws if no session exists.
 * Use inside route handlers that are already guarded by middleware.
 */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) {
    throw new Error("Unauthenticated — middleware should have caught this");
  }
  return principal;
}
