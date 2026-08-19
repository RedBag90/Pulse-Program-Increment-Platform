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
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";
import { StructurePageShell } from "@/modules/core/org/features/structure/components/structure-page-shell";

/**
 * Struktur-Page — Master-Detail-Layout fuer **Value Streams + ARTs**.
 * Timelines leben unter `/timelines` als eigene Surface; der Struktur-Tree
 * laedt sie nur, damit das ART-Detail-Pane den Timeline-Namen zeigen kann.
 */
export default async function StructurePage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  // Pro Affordance gegen die zugehörige Capability prüfen — kein
  // Sammel-`timeline.manage`-Flag mehr, das die Buttons für VS/ART
  // verschluckte. Platform-/Tenant-Admin passieren überall via Fast-Path
  // in `authorize()`.
  const canCreateVs = hasCapability(principal, "value_stream.create");
  const canUpdateVs = hasCapability(principal, "value_stream.update");
  const canCreateArt = hasCapability(principal, "art.create");
  const canUpdateArt = hasCapability(principal, "art.update");
  const canDeleteArt = hasCapability(principal, "art.delete");

  const [tree, timeline, userLabels, budgetTotals] = await Promise.all([
    getStructureTree(db, principal.tenantId),
    // Timeline-Daten nur fuer das ART-Detail (Anzeige des Timeline-Namens).
    getStructureTimeline(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
    // Budgeting ist ein oberes Modul: ohne Entitlement bleibt die Map leer und
    // der Struktur-Baum rendert die Budget-Spalte gar nicht (Degradation, ADR-0013).
    principal.enabledModules.includes("budgeting")
      ? getValueStreamBudgetTotals(db, principal.tenantId)
      : Promise.resolve({}),
  ]);

  const model = buildStructurePageModel({
    mode: "structure",
    tree,
    timeline,
    userLabels,
    budgetTotals,
  });

  return (
    <Suspense fallback={null}>
      <StructurePageShell
        title="Struktur"
        subtitle="Die Organisation hinter dem Portfolio — Wertströme und ARTs."
        availableKinds={["vs", "art"]}
        model={model}
        canCreateVs={canCreateVs}
        canUpdateVs={canUpdateVs}
        canCreateArt={canCreateArt}
        canUpdateArt={canUpdateArt}
        canDeleteArt={canDeleteArt}
        canManageTimeline={false}
      />
    </Suspense>
  );
}
