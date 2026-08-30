import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import {
  getPortfolioGuardrailsInputs,
  getBusinessOwnerEngagementInputs,
} from "@/modules/work/server/services/portfolio-dashboard";
import { computePortfolioGuardrails } from "@/modules/work/server/views/portfolio-guardrails-view";
import { GuardrailsView } from "@/modules/work/features/portfolio/components/guardrails/guardrails-view";

/**
 * SAFe Portfolio Guardrails — Ist-Mix gegen den vom LPM gesetzten Soll-Mix.
 * Drei Achsen: Investment by Horizon, Capacity Allocation (Business vs Enabler)
 * und Business-Owner-Engagement. Reine Lese-Flaeche; die Targets werden auf der
 * Controlling-Uebersicht gepflegt.
 */
export default async function PortfolioGuardrailsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [guardrails, boEpics] = await Promise.all([
    getPortfolioGuardrailsInputs(db, principal.tenantId),
    getBusinessOwnerEngagementInputs(db, principal.tenantId),
  ]);

  const model = computePortfolioGuardrails({
    epics: guardrails.epics,
    targets: guardrails.targets,
    engagement: { epics: boEpics, now: new Date() },
  });

  const canManageTargets = authorize(
    "target.manage",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  return (
    <GuardrailsView
      model={model}
      epicCount={guardrails.epics.length}
      canManageTargets={canManageTargets}
    />
  );
}
