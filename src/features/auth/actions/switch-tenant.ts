"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createPrismaClient } from "@/server/db/prisma";
import { ACTIVE_TENANT_COOKIE } from "@/server/auth/principal";
import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";

// Justified exception: Tenant-Wechsel läuft nicht über createServerAction —
// die Factory autorisiert gegen den AKTIVEN Tenant, hier wechseln wir ihn
// gerade. Die Autorisierung ist die Mitgliedschafts-Prüfung selbst (User hat
// ein Assignment im Ziel-Tenant); danach wird nur das Cookie gesetzt.

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax", path: "/" } as const;

export type SwitchTenantState = { error?: string };

export async function switchTenantAction(
  _prev: SwitchTenantState,
  formData: FormData,
): Promise<SwitchTenantState> {
  const parsed = z.object({ tenantId: z.string().uuid() }).safeParse({
    tenantId: formData.get("tenantId"),
  });
  if (!parsed.success) return { error: "Ungültiger Bereich" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet" };

  // Mitgliedschaft im Ziel-Tenant prüfen (Bootstrap-Client, wie getPrincipal).
  const db = createPrismaClient({ userId: user.id as UserId, tenantId: "" as TenantId });
  const membership = await db.userRoleAssignment.findFirst({
    where: { userId: user.id, tenantId: parsed.data.tenantId },
    select: { id: true },
  });
  if (!membership) return { error: "Kein Zugang zu diesem Bereich" };

  (await cookies()).set(ACTIVE_TENANT_COOKIE, parsed.data.tenantId, COOKIE_OPTS);
  return {};
}

/** Beim Sign-out die Tenant-Auswahl räumen (Cookie ist httpOnly — nur serverseitig löschbar). */
export async function clearTenantCookieAction(): Promise<void> {
  (await cookies()).delete(ACTIVE_TENANT_COOKIE);
}
