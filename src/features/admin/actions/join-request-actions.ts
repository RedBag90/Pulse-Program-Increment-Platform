"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import {
  rotateInvite,
  deactivateInvite,
  setInviteAutoAccept,
  decideJoinRequest,
} from "@/server/services/tenant-invite";

/**
 * Server-Actions für die tenant_admin-Verwaltung offener Beitritte
 * (`/admin/anfragen`). Gate: `tenant.users.manage` gegen den AKTIVEN Tenant
 * (tenant-scoped) — kein Platform-Guard. Direkt aufrufbar (via useTransition),
 * nicht form-gebunden.
 */

export interface JoinAdminState {
  error?: string;
  success?: boolean;
}

async function requireInviteManager() {
  const principal = await requirePrincipal();
  if (!authorize("tenant.users.manage", { tenantId: principal.tenantId }, principal).allow) {
    return null;
  }
  return principal;
}

export async function rotateInviteAction(): Promise<JoinAdminState> {
  const principal = await requireInviteManager();
  if (!principal) return { error: "Keine Berechtigung" };
  const res = await rotateInvite(principal);
  return res.ok ? { success: true } : { error: res.error };
}

export async function deactivateInviteAction(): Promise<JoinAdminState> {
  const principal = await requireInviteManager();
  if (!principal) return { error: "Keine Berechtigung" };
  const res = await deactivateInvite(principal);
  return res.ok ? { success: true } : { error: res.error };
}

export async function setInviteAutoAcceptAction(autoAccept: boolean): Promise<JoinAdminState> {
  const principal = await requireInviteManager();
  if (!principal) return { error: "Keine Berechtigung" };
  const res = await setInviteAutoAccept(principal, autoAccept);
  return res.ok ? { success: true } : { error: res.error };
}

export async function decideJoinRequestAction(
  requestId: string,
  approve: boolean,
): Promise<JoinAdminState> {
  const principal = await requireInviteManager();
  if (!principal) return { error: "Keine Berechtigung" };
  const res = await decideJoinRequest(principal, requestId, approve);
  return res.ok ? { success: true } : { error: res.error };
}
