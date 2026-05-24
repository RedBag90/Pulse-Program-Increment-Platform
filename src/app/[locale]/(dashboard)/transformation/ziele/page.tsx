import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listGoals } from "@/server/services/target-goal";
import { listEpics } from "@/server/services/epic";
import { listTargetOutcomes } from "@/server/services/target-outcome";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { GoalsManager } from "@/features/transformation/components/goals-manager";
import { TargetOutcomesManager } from "@/features/transformation/components/target-outcomes-manager";

/**
 * Strategische Ziele — wo Senior Management die Richtung der Transformation
 * vorgibt: Ziele definieren, KPIs daranhängen, realisierende Epics verknüpfen.
 * Bearbeiten mit `target.manage`; sonst read-only.
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
  const unboundKpis = outcomes.filter((o) => o.goalId == null);

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Strategische Ziele</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die vom Senior Management vorgegebene Richtung der Transformation — Ziele, ihre KPIs und
          die Epics, die sie realisieren.
        </p>
      </header>

      <GoalsManager
        canManage={canManage}
        epicOptions={epics.map((e) => ({ id: e.id, title: e.title }))}
        userOptions={Object.entries(userLabels).map(([id, label]) => ({ id, label }))}
        goals={goals.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          ownerId: g.ownerId,
          dueDate: g.dueDate ? g.dueDate.toISOString().slice(0, 10) : null,
          status: g.status,
          kpis: g.kpis.map((k) => ({
            id: k.id,
            title: k.title,
            metricUnit: k.metricUnit,
            baseline: k.baseline,
            target: k.target,
            current: k.current,
          })),
          epics: g.epicLinks.map((l) => ({
            id: l.epic.id,
            title: l.epic.title,
            status: l.epic.status,
          })),
        }))}
      />

      <TargetOutcomesManager
        canManage={canManage}
        outcomes={unboundKpis.map((o) => ({
          id: o.id,
          title: o.title,
          metricUnit: o.metricUnit,
          baseline: o.baseline,
          target: o.target,
          current: o.current,
          dueDate: o.dueDate ? o.dueDate.toISOString().slice(0, 10) : null,
        }))}
      />
    </div>
  );
}
