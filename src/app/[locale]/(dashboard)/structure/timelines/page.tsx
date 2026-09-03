import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
} from "@/modules/core/org/server/services/structure";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listPiStandards } from "@/modules/drumbeat/server/services/pi-standard";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";
import { TimelinesPageShell } from "@/modules/drumbeat/features/cadence/components/timelines-page-shell";

/**
 * Timelines-Page — Master-Detail-Layout fuer **Timelines** + ihre PIs +
 * subscribierte ARTs. Strukturdaten (VS/ART/Team) werden geladen, damit
 * Click-Throughs aus dem Timeline-Detail (z. B. „ART joinen") die
 * zugehoerigen ART-Details zeigen koennen — die Liste selbst zeigt aber
 * nur Timelines.
 *
 * Gerendert wird über den Client-Adapter `TimelinesPageShell` statt direkt über
 * die `StructurePageShell`: das Detail-Pane wird per Render-Funktion injiziert,
 * und eine Funktion überlebt die RSC-Grenze nicht. Von hier gehen deshalb nur
 * serialisierbare Daten raus.
 */
export default async function TimelinesPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const canManageTimeline = hasCapability(principal, "timeline.manage");

  const [tree, timeline, userLabels, piStandards] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    getStructureTimeline(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    listPiStandards(db, principal.tenantId),
  ]);

  const model = buildStructurePageModel({
    mode: "timelines",
    tree,
    timeline,
    userLabels,
  });

  return (
    <Suspense fallback={null}>
      <TimelinesPageShell
        model={model}
        piStandards={piStandards}
        canManageTimeline={canManageTimeline}
      />
    </Suspense>
  );
}
