import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getStructureTimeline } from "@/modules/core/org/server/services/structure";
import { listPiStandards } from "@/modules/drumbeat/server/services/pi-standard";
import { buildStructurePageModel } from "@/modules/core/org/server/views/structure-page";
import { TimelinesPageShell } from "@/modules/drumbeat/features/cadence/components/timelines-page-shell";

/**
 * Timelines-Page — Master-Detail-Layout für **Timelines** + ihre PIs +
 * subscribierte ARTs.
 *
 * Der Organisations-Baum und die Personennamen wurden hier bis September 2026
 * mitgeladen und an **niemanden** weitergereicht: das gemeinsame Seitenmodell
 * baute daraus Wertstrom- und ART-Details, die diese Fläche nie las. Mit dem
 * Wegfall des Baums sind sie entfallen — zwei Abfragen und ein
 * Supabase-`listUsers` weniger je Aufruf.
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

  const [timeline, piStandards] = await Promise.all([
    getStructureTimeline(db, principal.tenantId),
    listPiStandards(db, principal.tenantId),
  ]);

  const model = buildStructurePageModel({ timeline });

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
