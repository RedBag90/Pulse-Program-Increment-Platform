import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  computeStructureGap,
  computePracticeAdoption,
  goalKpiProgress,
} from "@/server/services/transformation";
import { getActiveTargetModel } from "@/server/services/target-model";
import { listTargetOutcomes } from "@/server/services/target-outcome";
import { listGoals } from "@/server/services/target-goal";
import { listSnapshots, sparklinePoints } from "@/server/services/transformation-snapshot";
import { listTransformationActions } from "@/server/services/target-action";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { effectivePractices, type OperatingModelTemplate } from "@/domain/operating-model";
import { TransformationCockpit } from "@/features/transformation/components/transformation-cockpit";
import { TransformationActionsManager } from "@/features/transformation/components/transformation-actions-manager";

/**
 * Transformation cockpit — the management view of how far the organisation is
 * from the declared target operating model (Soll/Ist).
 */
export default async function TransformationPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [gap, adoption, outcomes, activeModel, actions, userLabels, goals, snapshots] =
    await Promise.all([
      computeStructureGap(db, principal.tenantId),
      computePracticeAdoption(db, principal.tenantId),
      listTargetOutcomes(db, principal.tenantId),
      getActiveTargetModel(db, principal.tenantId),
      listTransformationActions(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      listGoals(db, principal.tenantId),
      listSnapshots(db, principal.tenantId),
    ]);
  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  const userOptions = Object.entries(userLabels).map(([id, label]) => ({ id, label }));

  // The cockpit shows the active strategic goals (archived ones are parked).
  const goalSummaries = goals
    .filter((g) => g.status !== "archived")
    .map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      kpiProgress: goalKpiProgress(g.kpis),
      kpiCount: g.kpis.length,
      epicCount: g.epicLinks.length,
    }));

  // "Reise über Zeit": serialise the captured snapshots and pre-compute the
  // sparkline geometry server-side (the client panel stays free of the service).
  const TREND_W = 280;
  const TREND_H = 48;
  const snapshotPoints = snapshots.map((s) => ({
    capturedOn: s.capturedOn.toISOString().slice(0, 10),
    goalAchievement: s.goalAchievement,
    achievedGoalCount: s.achievedGoalCount,
    goalCount: s.goalCount,
  }));
  const firstAchieved = snapshots.find((s) => s.achievedGoalCount > 0);
  const trend = {
    snapshots: snapshotPoints,
    points: sparklinePoints(
      snapshots.map((s) => s.goalAchievement),
      TREND_W,
      TREND_H,
    ),
    viewBox: { width: TREND_W, height: TREND_H },
    firstAchievement: firstAchieved
      ? { capturedOn: firstAchieved.capturedOn.toISOString().slice(0, 10) }
      : null,
  };

  const model = activeModel
    ? {
        template: (activeModel.template as OperatingModelTemplate | null) ?? null,
        status: activeModel.status,
        targetDate: activeModel.targetDate
          ? activeModel.targetDate.toISOString().slice(0, 10)
          : null,
        practices: effectivePractices(activeModel),
      }
    : null;

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Transformation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fortschritt der Organisation hin zum definierten Zielzustand.
        </p>
      </header>

      <TransformationCockpit
        model={model}
        goals={goalSummaries}
        gap={gap}
        adoption={adoption}
        trend={trend}
        canManage={canManage}
        outcomes={outcomes
          .filter((o) => o.goalId == null) // goal-bound KPIs show under their goal
          .map((o) => ({
            id: o.id,
            title: o.title,
            metricUnit: o.metricUnit,
            baseline: o.baseline,
            target: o.target,
            current: o.current,
            dueDate: o.dueDate ? o.dueDate.toISOString().slice(0, 10) : null,
          }))}
      />

      <TransformationActionsManager
        canManage={canManage}
        userOptions={userOptions}
        actions={actions.map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          ownerId: a.ownerId,
          dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null,
        }))}
      />
    </div>
  );
}
