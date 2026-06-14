import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { computeStructureGap, computePracticeAdoption } from "@/server/services/transformation";
import { getActiveTargetModel } from "@/server/services/target-model";
import { listSnapshots } from "@/server/services/transformation-snapshot";
import { buildCockpitModel } from "@/server/views/transformation-cockpit";
import { TransformationCockpit } from "@/features/transformation/components/transformation-cockpit";

/**
 * Transformation-Maturity-Cockpit. Nach P0-P5 lebt der Strategie-
 * Layer (Themes/Objectives/Key Results/€-Rollup) unter `/ziele`;
 * dieses Cockpit zeigt nur noch den Operating-Model-Reifegrad
 * (Struktur, Praktiken, Soll-Reife-Trend) plus einen Deep-Link auf
 * das Ziele-Modul fuer die strategische Ebene.
 */
export default async function TransformationPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [gap, adoption, activeModel, snapshots] = await Promise.all([
    computeStructureGap(db, principal.tenantId),
    computePracticeAdoption(db, principal.tenantId),
    getActiveTargetModel(db, principal.tenantId),
    listSnapshots(db, principal.tenantId),
  ]);
  const canManage = authorize("target.manage", { tenantId: principal.tenantId }, principal).allow;

  const cockpit = buildCockpitModel({ snapshots, activeModel, gap, adoption });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Transformation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reifegrad der Organisation gegenueber dem definierten Zielzustand. Strategische Ziele
          (Themes &amp; OKRs) wandern ins{" "}
          <Link className="text-primary hover:underline" href="/ziele">
            Ziele-Modul
          </Link>
          .
        </p>
      </header>

      <TransformationCockpit model={cockpit} canManage={canManage} />
    </div>
  );
}
