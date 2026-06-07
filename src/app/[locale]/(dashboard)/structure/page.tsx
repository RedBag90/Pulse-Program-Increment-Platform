import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getStructureTree, getStructureTimeline } from "@/server/services/structure";
import { getValueStreamBudgets } from "@/server/services/budgeting";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listPiStandards } from "@/server/services/pi-standard";
import { buildStructurePageModel } from "@/server/views/structure-page";
import { StructurePageShell } from "@/features/structure/components/structure-page-shell";

/**
 * Structure hub — master-detail layout. Loads the VS->ART->Team tree, the
 * timelines, value-stream budgets and user labels in one round-trip, builds
 * the flat row list + per-entity detail shapes via the page-model, and hands
 * everything to the URL-state shell.
 *
 * Replaces the three previous tabs (Übersicht · Timeline · ARTs) with one
 * cohesive surface — gap signals (missing VMO / RTE / SM) surface as row
 * badges, not in a separate Overview tab.
 */
export default async function StructurePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const isAdmin = hasCapability(principal, "timeline.manage");
  const canCreateVs = hasCapability(principal, "value_stream.create");

  const [tree, timeline, userLabels, vsBudgets, piStandards] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    getStructureTimeline(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    getValueStreamBudgets(db, principal.tenantId),
    listPiStandards(db, principal.tenantId),
  ]);

  const budgetTotals = Object.fromEntries(
    vsBudgets.valueStreams.map((b) => [b.valueStreamId, b.total]),
  );

  const model = buildStructurePageModel({
    tree,
    timeline,
    userLabels,
    budgetTotals,
  });

  return (
    <Suspense fallback={null}>
      <StructurePageShell
        model={model}
        canCreateVs={canCreateVs}
        canCreateArt={isAdmin}
        canCreateTeam={isAdmin}
        canManageTimeline={isAdmin}
        piStandards={piStandards.map((s) => ({ id: s.id, name: s.name }))}
      />
    </Suspense>
  );
}
