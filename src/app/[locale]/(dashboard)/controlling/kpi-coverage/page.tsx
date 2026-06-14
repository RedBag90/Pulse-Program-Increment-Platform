import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadZieleModel } from "@/server/views/ziele-view";
import { KpiCoverageView } from "@/features/controlling/components/kpi-coverage-view";

/**
 * KPI-Coverage (Refactor-Plan §B). KPI-Bibliothek mit valuePerUnit-
 * Pflege + KR↔KPI-Bindungen pro Key Result. Strategie-Definition
 * lebt unter `/strategy`; hier nur die Bewertungs-Bruecke zwischen
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
  const model = await loadZieleModel(db, principal, {});

  return (
    <main className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KPI-Coverage</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            valuePerUnit pflegen, Key Results an KPIs binden. Strategie-Definition unter{" "}
            <Link href="/strategy" className="text-primary hover:underline">
              Strategie
            </Link>
            .
          </p>
        </div>
        <Link
          href="/controlling"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Controlling
        </Link>
      </div>

      <KpiCoverageView model={model} canEdit />
    </main>
  );
}
