import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { buildGoalFieldsPageModel } from "@/modules/core/goals/server/views/admin-goal-fields";
import { GoalFieldsPageShell } from "@/features/admin/components/goal-fields-page-shell";

/**
 * Admin-Seite „Custom Fields" (Epic 7). Tenant-Admins definieren hier tenant-
 * weite Zusatzfelder (text/number/select), die pro Ziel-Knoten im Drawer
 * gepflegt werden. Gate: `goal.custom_field.manage`.
 */
export default async function AdminGoalFieldsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!hasCapability(principal, "goal.custom_field.manage")) {
    redirect("/portfolio");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await buildGoalFieldsPageModel(db, principal.tenantId, true);

  return (
    <Suspense fallback={null}>
      <GoalFieldsPageShell model={model} />
    </Suspense>
  );
}
