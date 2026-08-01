"use server";

import { requirePlatformAdmin } from "@/server/auth/platform";
import { decideProvisionRequest } from "@/server/services/tenant-provision";

/**
 * Platform-Server-Action für Provisioning-Anträge (Genehmigen/Ablehnen).
 * Wächter `requirePlatformAdmin`; direkt aufrufbar (via useTransition).
 */
export interface ProvisionActionState {
  error?: string;
  success?: boolean;
}

export async function decideProvisionAction(
  requestId: string,
  approve: boolean,
): Promise<ProvisionActionState> {
  const actor = await requirePlatformAdmin();
  const res = await decideProvisionRequest(actor, requestId, approve);
  return res.ok ? { success: true } : { error: res.error };
}
