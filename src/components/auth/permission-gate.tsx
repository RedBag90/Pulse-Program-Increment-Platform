import type { ReactNode } from "react";
import { requirePrincipal } from "@/server/auth/principal";
import { hasPermission, type AuthResource } from "@/server/auth/authorize";
import type { Action } from "@/server/auth/policies";

interface Props {
  /** The action the viewer must be permitted to perform. */
  action: Action;
  /** The resource the action targets; `tenantId` is filled in from the principal. */
  resource?: Omit<AuthResource, "tenantId">;
  children: ReactNode;
  /** Rendered instead of `children` when the viewer lacks the permission. */
  fallback?: ReactNode;
}

/**
 * Server component that renders its children only when the current principal
 * is permitted to perform `action`. Centralises the inline `roles.includes(...)`
 * checks scattered across pages (technical-concept §10.7).
 */
export async function PermissionGate({ action, resource, children, fallback = null }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) return <>{fallback}</>;

  const allowed = hasPermission(action, { tenantId: principal.tenantId, ...resource }, principal);
  return <>{allowed ? children : fallback}</>;
}
