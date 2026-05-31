import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { halfYearKey, halfYearLabel } from "@/domain/calendar";
import { getLatestBudgetPlanRevision } from "@/server/services/budget-plan-revision";
import { CaptureRevisionButton } from "@/features/controlling/components/capture-revision-button";

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
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Budget-Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eingefrorene Halbjahres-Sicht auf die teilnehmende Budgetierung — Epic-Reihenfolge,
          Allokationen, Wertstrom- und ART-Roll-up, Features im Zyklus.
        </p>
      </div>
      <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Noch keine Revision erfasst.</p>
        {canCapture && (
          <div className="mt-4 flex justify-center">
            <CaptureRevisionButton cycleLabel={cycleLabel} variant="primary" />
          </div>
        )}
      </div>
    </main>
  );
}
