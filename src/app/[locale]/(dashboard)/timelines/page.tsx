import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
} from "@/modules/core/org/server/services/structure";
import { getValueStreamBudgets } from "@/modules/budgeting/server/services/budgeting";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listPiStandards } from "@/modules/drumbeat/server/services/pi-standard";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";
import { StructurePageShell } from "@/modules/core/org/features/structure/components/structure-page-shell";
import { CreateTimelineButton } from "@/modules/drumbeat/features/cadence/components/create-timeline-button";
import { TimelineDetailPane } from "@/modules/drumbeat/features/cadence/components/timeline-detail-pane";

/**
 * Timelines-Page — Master-Detail-Layout fuer **Timelines** + ihre PIs +
 * subscribierte ARTs. Strukturdaten (VS/ART/Team) werden geladen, damit
 * Click-Throughs aus dem Timeline-Detail (z. B. „ART joinen") die
 * zugehoerigen ART-Details zeigen koennen — die Liste selbst zeigt aber
 * nur Timelines.
 */
export default async function TimelinesPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const canManageTimeline = hasCapability(principal, "timeline.manage");
  const canCreateArt = hasCapability(principal, "art.create");
  const canUpdateArt = hasCapability(principal, "art.update");
  const canDeleteArt = hasCapability(principal, "art.delete");
  const canUpdateVs = hasCapability(principal, "value_stream.update");

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
    mode: "timelines",
    tree,
    timeline,
    userLabels,
    budgetTotals,
  });

  return (
    <Suspense fallback={null}>
      <StructurePageShell
        title="Timelines"
        subtitle="Geteilte PI-Kadenzen — Timelines, ihre PIs und subscribierte ARTs."
        availableKinds={["timeline"]}
        model={model}
        canCreateVs={false}
        canUpdateVs={canUpdateVs}
        canCreateArt={canCreateArt}
        canUpdateArt={canUpdateArt}
        canDeleteArt={canDeleteArt}
        canManageTimeline={canManageTimeline}
        createTimelineSlot={<CreateTimelineButton />}
        renderTimelineDetail={(timeline, onSelectNode) => (
          <TimelineDetailPane
            timeline={timeline}
            canManage={canManageTimeline}
            piStandards={piStandards}
            onSelectNode={onSelectNode}
          />
        )}
      />
    </Suspense>
  );
}
