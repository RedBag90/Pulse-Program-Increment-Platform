import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadRoundSetup } from "@/modules/budgeting/server/views/round-view";
import { loadZonesModel } from "@/modules/budgeting/server/views/zones-view";
import { loadDecisionsModel } from "@/modules/budgeting/server/views/decisions-view";
import { RoundSetup } from "@/modules/budgeting/features/components/round/round-setup";
import { RoundCapture } from "@/modules/budgeting/features/components/round/round-capture";
import { RoundDecisions } from "@/modules/budgeting/features/components/round/round-decisions";
import { RoundStepper } from "@/modules/budgeting/features/components/round/round-stepper";
import { Page, PageHeader } from "@/components/layout";
import { redirect } from "next/navigation";

/**
 * Participatory-Budgeting-Runde — Setup: Rahmen (Topf/Termin) + heterogene
 * Gruppen schneiden, dann die Runde starten. Erfassung/Zonen/Entscheidung folgen
 * in den nächsten Phasen.
 */
export default async function BudgetRoundsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadRoundSetup(db, principal);

  const showCapture = model.round && model.round.status !== "draft";
  const showDecisions = model.round && (model.round.status === "decided" || model.round.status === "closed");
  const [zones, decisions] = await Promise.all([
    showCapture ? loadZonesModel(db, principal.tenantId, model.round!.id) : Promise.resolve(null),
    showDecisions ? loadDecisionsModel(db, principal, model.round!.id) : Promise.resolve(null),
  ]);

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Runde"
        subtitle="Mehrere Gruppen verteilen denselben Topf unabhängig; ausgewertet wird die Übereinstimmung (Drei-Zonen)."
      />
      <div className="space-y-6">
        <RoundStepper status={model.round?.status ?? null} />
        <RoundSetup model={model} />
        {zones && <RoundCapture model={zones} canManage={model.canManage} />}
        {decisions && <RoundDecisions model={decisions} />}
      </div>
    </Page>
  );
}
