"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/platform";
import { setPlatformRole, suspendUser, reactivateUser } from "@/server/services/platform-user";
import type { ActionState } from "@/features/platform/actions/tenant-actions";

/**
 * Server-Actions des Plattform-Nutzer-Tabs. Wächter `requirePlatformAdmin`;
 * die Guardrails (kein Selbst-Suspend, letzten platform_admin nicht demoten)
 * liegen im `platform-user`-Service.
 */

export async function setPlatformRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ userId: z.string().uuid(), grant: z.enum(["true", "false"]) })
    .safeParse({ userId: formData.get("userId"), grant: formData.get("grant") });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await setPlatformRole(actor, parsed.data.userId, parsed.data.grant === "true");
  if (!res.ok) return { error: res.error };
  return { success: true };
}

export async function suspendUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await suspendUser(actor, parsed.data.userId);
  if (!res.ok) return { error: res.error };
  return { success: true };
}

export async function reactivateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Ungültige Eingabe" };

  const actor = await requirePlatformAdmin();
  const res = await reactivateUser(actor, parsed.data.userId);
  if (!res.ok) return { error: res.error };
  return { success: true };
}
