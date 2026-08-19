import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { isCurrentCycle } from "@/modules/budgeting/server/views/controlling-overview";
import {
  getBudgetPlanRevision,
  listBudgetPlanRevisionCycles,
} from "@/modules/budgeting/server/services/budget-plan-revision";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { BudgetPlanRevisionView } from "@/modules/budgeting/features/components/revision/budget-plan-revision-view";
import { buildBudgetPlanRevisionModel } from "@/modules/budgeting/server/views/budget-plan-revision";
import { CaptureRevisionButton } from "@/modules/budgeting/features/components/revision/capture-revision-button";
import { Link } from "@/i18n/navigation";
import { Page } from "@/components/layout";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Detail-Seite einer einzelnen Budget-Plan-Revision. Lädt den Snapshot, die
 * Liste aller Revisionen für die Navigation und die Tenant-Userlabels für die
 * Auflösung der `capturedBy`-UUID.
 */
export default async function BudgetPlanRevisionDetailPage({ params }: Props) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  // Die Zyklus-Navigation braucht nur Ids + Labels; `listBudgetPlanRevisionCycles`
  // liest dafuer keinen Payload. Vorher zog die Seite die volle Header-Liste und
  // deserialisierte damit jeden Snapshot — den dieser Revision sogar zweimal.
  const [revision, history, userLabels] = await Promise.all([
    getBudgetPlanRevision(db, principal.tenantId, id),
    listBudgetPlanRevisionCycles(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  if (!revision) notFound();

  const canCapture = authorize(
    "budget_plan.revision.capture",
    { tenantId: principal.tenantId },
    principal,
  ).allow;
  const now = new Date();
  const currentCycleLabel = halfYearLabel(halfYearKey(now));
  const showRecapture = canCapture && isCurrentCycle(revision.cycleKey, now);

  return (
    <Page>
      <div className="flex items-baseline justify-between gap-3">
        <Link href="/budgeting" className="text-xs font-medium text-primary hover:underline">
          ← Controlling-Übersicht
        </Link>
        {showRecapture && (
          <CaptureRevisionButton cycleLabel={currentCycleLabel} variant="compact" />
        )}
      </div>

      {history.length > 1 && (
        <nav className="flex flex-wrap gap-1.5 text-xs">
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/budgeting/budget-plan/${h.id}`}
              className={`rounded-full border px-2.5 py-1 ${
                h.id === revision.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {h.cycleLabel}
            </Link>
          ))}
        </nav>
      )}

      <BudgetPlanRevisionView
        model={buildBudgetPlanRevisionModel(revision.snapshot)}
        capturedBy={revision.capturedBy}
        userLabels={userLabels}
      />
    </Page>
  );
}
