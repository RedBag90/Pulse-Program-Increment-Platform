import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { computeStructureGap, computePracticeAdoption } from "@/server/services/transformation";
import { getActiveTargetModel } from "@/server/services/target-model";
import { listTargetOutcomes } from "@/server/services/target-outcome";
import { listGoals } from "@/server/services/target-goal";
import { listSnapshots } from "@/server/services/transformation-snapshot";
import { buildCockpitModel } from "@/server/views/transformation-cockpit";
import { TransformationCockpit } from "@/features/transformation/components/transformation-cockpit";

/**
 * Transformation cockpit — the management view of how far the organisation is
 * from the declared target operating model (Soll/Ist).
 */
export default async function TransformationPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [gap, adoption, outcomes, activeModel, goals, snapshots] = await Promise.all([
    computeStructureGap(db, principal.tenantId),
    computePracticeAdoption(db, principal.tenantId),
    listTargetOutcomes(db, principal.tenantId),
    getActiveTargetModel(db, principal.tenantId),
    listGoals(db, principal.tenantId),
    listSnapshots(db, principal.tenantId),
  ]);
  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;

  const {
    model,
    goals: goalSummaries,
    trend,
    outcomes: outcomeViews,
  } = buildCockpitModel({
    goals,
    snapshots,
    activeModel,
    outcomes,
  });

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
        outcomes={outcomeViews}
      />
    </div>
  );
}
