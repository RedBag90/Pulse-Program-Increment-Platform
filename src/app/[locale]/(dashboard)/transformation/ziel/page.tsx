import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { getWorkingTargetModel } from "@/server/services/target-model";
import {
  OPERATING_MODEL_TEMPLATE_DEFS,
  effectivePractices,
  type OperatingModelTemplate,
} from "@/domain/operating-model";
import { TargetModelForm } from "@/features/transformation/components/target-model-form";

/**
 * Target operating model configurator — where management declares the "Soll"
 * the transformation drives toward. Editable only with the `target.manage`
 * capability; everyone else sees a read-only view.
 */
export default async function TargetStatePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await getWorkingTargetModel(db, principal.tenantId);

  const initial = model
    ? {
        template: (model.template ?? "custom") as OperatingModelTemplate,
        targetDate: model.targetDate ? model.targetDate.toISOString().slice(0, 10) : null,
        structure: {
          targetValueStreams: model.targetValueStreams,
          targetArtsTotal: model.targetArtsTotal,
          targetTeamsTotal: model.targetTeamsTotal,
          targetPiCadenceWeeks: model.targetPiCadenceWeeks,
        },
        practices: effectivePractices(model),
      }
    : {
        template: "custom" as OperatingModelTemplate,
        targetDate: null,
        structure: OPERATING_MODEL_TEMPLATE_DEFS.custom.structure,
        practices: OPERATING_MODEL_TEMPLATE_DEFS.custom.practices,
      };

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Zielzustand</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Definiere das angestrebte Betriebsmodell der Organisation. Daran misst Pulse den
          Fortschritt — und blendet aus, was nicht Teil des Ziels ist.
        </p>
      </header>

      <TargetModelForm canManage={canManage} status={model?.status ?? null} initial={initial} />
    </div>
  );
}
