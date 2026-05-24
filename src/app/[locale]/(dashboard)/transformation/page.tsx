import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { computeStructureGap, computePracticeAdoption } from "@/server/services/transformation";
import { getActiveTargetModel } from "@/server/services/target-model";
import { listTargetOutcomes } from "@/server/services/target-outcome";
import { effectivePractices, type OperatingModelTemplate } from "@/domain/operating-model";
import { TransformationCockpit } from "@/features/transformation/components/transformation-cockpit";

/**
 * Transformation cockpit — the management view of how far the organisation is
 * from the declared target operating model (Soll/Ist).
 */
export default async function TransformationPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [gap, adoption, outcomes, activeModel] = await Promise.all([
    computeStructureGap(db, principal.tenantId),
    computePracticeAdoption(db, principal.tenantId),
    listTargetOutcomes(db, principal.tenantId),
    getActiveTargetModel(db, principal.tenantId),
  ]);

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
        gap={gap}
        adoption={adoption}
        outcomes={outcomes.map((o) => ({
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
