import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
} from "@/modules/core/org/server/services/structure";
import { getValueStreamBudgetTotals } from "@/modules/budgeting/server/services/budgeting";
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
  const canCreateArt = hasCapability(principal, "art.create");
  const canUpdateArt = hasCapability(principal, "art.update");
  const canDeleteArt = hasCapability(principal, "art.delete");
  const canUpdateVs = hasCapability(principal, "value_stream.update");

  const [tree, timeline, userLabels, budgetTotals, piStandards] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    getStructureTimeline(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    // Budgeting ist ein oberes Modul: ohne Entitlement bleibt die Map leer und
    // der Struktur-Baum rendert die Budget-Spalte gar nicht (Degradation, ADR-0013).
    principal.enabledModules.includes("budgeting")
      ? getValueStreamBudgetTotals(db, principal.tenantId)
      : Promise.resolve({}),
    listPiStandards(db, principal.tenantId),
  ]);

  const model = buildStructurePageModel({
    mode: "timelines",
    tree,
    timeline,
    userLabels,
    budgetTotals,
  });

  return (
    <Suspense fallback={null}>
      <TimelinesPageShell
        model={model}
        piStandards={piStandards}
        canUpdateVs={canUpdateVs}
        canCreateArt={canCreateArt}
        canUpdateArt={canUpdateArt}
        canDeleteArt={canDeleteArt}
        canManageTimeline={canManageTimeline}
      />
    </Suspense>
  );
}
