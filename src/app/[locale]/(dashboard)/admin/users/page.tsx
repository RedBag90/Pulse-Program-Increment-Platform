import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildUsersPageModel } from "@/server/views/admin-users";
import { UsersPageShell } from "@/features/admin/components/users-page-shell";

/**
 * Admin users page — master-detail layout. Loads role assignments, value
 * streams + ARTs (scope picker), and user labels in one round-trip, builds
 * the per-user view via the page-model, and hands it to the URL-state shell.
 * Editing gates on `tenant.users.manage`; reading on `admin.users.read`.
 */
export default async function AdminUsersPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");
  if (!hasCapability(principal, "admin.users.read")) redirect("/portfolio");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [assignments, valueStreams, userLabels] = await Promise.all([
    db.userRoleAssignment.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: { createdAt: "asc" },
    }),
    db.valueStream.findMany({
      where: { tenantId: principal.tenantId, deletedAt: null },
      include: { arts: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const canManage = hasCapability(principal, "tenant.users.manage");
  const model = buildUsersPageModel({ assignments, valueStreams, userLabels });

  return (
    // useSearchParams reads dynamic URL state; Suspense satisfies Next's boundary requirement.
    <Suspense fallback={null}>
      <UsersPageShell model={model} canManage={canManage} />
    </Suspense>
  );
}
