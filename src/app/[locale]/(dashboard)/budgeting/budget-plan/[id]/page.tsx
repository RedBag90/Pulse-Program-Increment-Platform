import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getBudgetPlanRevision,
  listBudgetPlanRevisionCycles,
} from "@/modules/budgeting/server/services/budget-plan-revision";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { BudgetPlanRevisionView } from "@/modules/budgeting/features/components/revision/budget-plan-revision-view";
import { buildBudgetPlanRevisionModel } from "@/modules/budgeting/domain/budget-plan-revision-model";
import { PbRoundProtocol } from "@/modules/budgeting/features/components/revision/pb-round-protocol";
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

  return (
    <Page>
      {/* Erfasst wird im Ergebnis-Reiter der Kachel — dort, wo die Zahlen
          entstehen. Diese Fläche ist reine Rückschau. */}
      <Link href="/budgeting/periods" className="text-xs font-medium text-primary hover:underline">
        ← Budgeting-Zeiträume
      </Link>

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

      {revision.round && <PbRoundProtocol round={revision.round} />}
    </Page>
  );
}
