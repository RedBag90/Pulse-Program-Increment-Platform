import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadStrategyTree, loadKpiInventory } from "@/server/views/ziele-view";
import { KpiCoverageView } from "@/features/controlling/components/kpi-coverage-view";
import { Page, PageHeader } from "@/components/layout";

/**
 * KPI-Coverage (Refactor-Plan §B). KPI-Bibliothek mit valuePerUnit-
 * Pflege + KR↔KPI-Bindungen pro Key Result. Strategie-Definition
 * lebt unter `/ziele`; hier nur die Bewertungs-Bruecke zwischen
 * Strategie und KPIs.
 *
 * Gate: `target.manage` (LPM/Controlling-Audience).
 */
export default async function KpiCoveragePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;
  if (!canManage) redirect("/controlling");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tree = await loadStrategyTree(db, principal.tenantId);
  const inventory = await loadKpiInventory(db, principal.tenantId, tree);

  return (
    <Page>
      <PageHeader
        title="KPI-Coverage"
        subtitle={
          <>
            valuePerUnit pflegen, Key Results an KPIs binden. Strategie-Definition unter{" "}
            <Link href="/ziele" className="text-primary hover:underline">
              Strategie
            </Link>
            .
          </>
        }
        actions={
          <Link
            href="/controlling"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Controlling
          </Link>
        }
      />

      <KpiCoverageView inventory={inventory} canEdit />
    </Page>
  );
}
