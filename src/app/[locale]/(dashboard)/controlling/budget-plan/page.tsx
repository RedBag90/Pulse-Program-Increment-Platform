import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { getLatestBudgetPlanRevision } from "@/modules/budgeting/server/services/budget-plan-revision";
import { CaptureRevisionButton } from "@/modules/budgeting/features/controlling/components/capture-revision-button";
import { Page, PageHeader } from "@/components/layout";

/**
 * Budget-Plan-Index — leitet auf die jüngste Revision weiter oder zeigt den
 * Empty-State, wenn noch keine erfasst wurde. Eigener Route-Knoten, damit der
 * Nav-Eintrag "Budget-Plan" ohne id-Wissen verlinkt werden kann.
 */
export default async function BudgetPlanIndexPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const latest = await getLatestBudgetPlanRevision(db, principal.tenantId);
  if (latest) redirect(`/controlling/budget-plan/${latest.id}`);

  const canCapture = authorize(
    "budget_plan.revision.capture",
    { tenantId: principal.tenantId },
    principal,
  ).allow;
  const cycleLabel = halfYearLabel(halfYearKey(new Date()));

  return (
    <Page>
      <PageHeader
        title="Budget-Plan"
        subtitle="Eingefrorene Halbjahres-Sicht auf die teilnehmende Budgetierung — Epic-Reihenfolge, Allokationen, Wertstrom- und ART-Roll-up, Features im Zyklus."
      />
      <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Noch keine Revision erfasst.</p>
        {canCapture && (
          <div className="mt-4 flex justify-center">
            <CaptureRevisionButton cycleLabel={cycleLabel} variant="primary" />
          </div>
        )}
      </div>
    </Page>
  );
}
