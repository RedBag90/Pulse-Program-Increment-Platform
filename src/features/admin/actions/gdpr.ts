"use server";

import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { eraseUserRecords } from "@/server/services/gdpr";
import { isErr } from "@/domain/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TenantId, UserId } from "@/domain/types";

/**
 * GDPR erasure: revokes the user's access and audit-logs it, then removes the
 * Supabase Auth account (erasing email/name). Audit history and authored
 * records are retained with the now-anonymous userId.
 */
export async function eraseUserAction(userId: string): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("tenant.users.manage", { tenantId: principal.tenantId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }
  if (userId === principal.id) {
    return { error: "You cannot erase your own account." };
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const result = await eraseUserRecords(
    db,
    principal.tenantId as TenantId,
    userId as UserId,
    principal.id,
  );
  if (isErr(result)) return { error: "Failed to erase the user's records." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return {
      error: "Records erased and access revoked, but the auth account could not be removed.",
    };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
