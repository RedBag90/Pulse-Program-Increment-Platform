import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listGoals } from "@/server/services/target-goal";
import { listEpics } from "@/server/services/epic";
import { listTargetOutcomes } from "@/server/services/target-outcome";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { buildGoalsPageModel } from "@/server/views/transformation-goals";
import { GoalsPageShell } from "@/features/transformation/components/goals-page-shell";

/**
 * Strategische Ziele — master-detail layout with a list on the left and an
 * editor pane on the right. Senior management defines goals, hangs KPIs on
 * them, and links realising Epics. Bearbeiten gates on `target.manage`;
 * sonst read-only. URL state (status filter, search, selection) lives in the
 * shell so this page is a thin load → build → render.
 */
export default async function GoalsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [goals, epics, userLabels, outcomes] = await Promise.all([
    listGoals(db, principal.tenantId),
    listEpics(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    listTargetOutcomes(db, principal.tenantId),
  ]);

  const model = buildGoalsPageModel({
    goals,
    outcomes,
    epics: epics.map((e) => ({ id: e.id, title: e.title })),
    userLabels,
  });

  return (
    // The shell reads useSearchParams; Suspense satisfies Next.js's
    // requirement that hooks reading dynamic URL state sit inside a boundary.
    <Suspense fallback={null}>
      <GoalsPageShell model={model} canManage={canManage} />
    </Suspense>
  );
}
