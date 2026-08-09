import { redirect } from "next/navigation";
import { getPrincipal } from "@/server/auth/principal";
import { createClient } from "@/lib/supabase/server";
import { createPrismaClient } from "@/server/db/prisma";
import { ensurePersonalTenant, ensurePlatformAdminBootstrap } from "@/server/services/tenant";
import { landingPathForRoles } from "@/domain/landing";
import { PERSONAL_DEFAULT_MODULES, firstEnabledHome } from "@/modules/core/kernel/domain/modules";
import type { TenantId, UserId } from "@/domain/types";

/**
 * Post-login entry point — resolves the principal and forwards to the
 * role-appropriate landing route (locale-preserving). Reached from the sign-in
 * action and the auth-only middleware redirect.
 *
 * Zusätzlich der **eine** Lazy-Ensure-Pfad des persönlichen Free-Tenants:
 *  - Session ohne Assignment (frischer Sign-up): personal-Tenant anlegen und
 *    direkt ins Ziele-Modul — fixt die frühere /start↔/sign-in-Endlosschleife.
 *  - Bestandsnutzer ohne persönlichen Bereich: still anlegen (erscheint im
 *    Tenant-Switcher), Landing bleibt die des aktiven Tenants.
 */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (!principal) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${locale}/sign-in`);

    const db = createPrismaClient({ userId: user.id as UserId, tenantId: "" as TenantId });
    const { tenantId } = await ensurePersonalTenant(db, user.id as UserId, user.email ?? "");
    await ensurePlatformAdminBootstrap(db, user.id as UserId, user.email ?? "", tenantId);
    // Frischer personal-Tenant ⇒ deterministisch ins Free-Modul (kein
    // /start-Re-Entry — vermeidet jede Loop-Möglichkeit).
    redirect(`/${locale}${firstEnabledHome(PERSONAL_DEFAULT_MODULES)}`);
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { tenantId: personalTenantId } = await ensurePersonalTenant(
    db,
    principal.id,
    principal.email,
  );
  await ensurePlatformAdminBootstrap(db, principal.id, principal.email, personalTenantId);

  redirect(
    `/${locale}${landingPathForRoles(principal.roles, principal.enabledModules, principal.tenantKind)}`,
  );
}
