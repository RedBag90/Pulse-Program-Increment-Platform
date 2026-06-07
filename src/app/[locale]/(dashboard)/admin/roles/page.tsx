import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { buildAdminRolesPageModel } from "@/server/views/admin-roles";
import { RolesPageShell } from "@/features/admin/components/roles-page-shell";

/**
 * Admin-Roles Surface. Tenant-Admins können hier pro Rolle einzelne
 * Capabilities zuweisen oder entziehen. Die DB-Tabelle `role_capabilities`
 * trägt die Tenant-spezifische Sicht; das Default-Bundle aus `POLICIES`
 * bleibt als Vergleichsanker.
 */
export default async function AdminRolesPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!hasCapability(principal, "role.capability.manage")) {
    redirect("/portfolio");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const rows = await db.roleCapability.findMany({
    where: { tenantId: principal.tenantId },
    select: { role: true, action: true, scope: true },
  });

  const canManage = hasCapability(principal, "role.capability.manage");
  const model = buildAdminRolesPageModel({ capabilities: rows });

  return (
    <Suspense fallback={null}>
      <RolesPageShell model={model} canManage={canManage} />
    </Suspense>
  );
}
