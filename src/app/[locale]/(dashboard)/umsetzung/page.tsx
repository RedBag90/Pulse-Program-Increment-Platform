import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { UmsetzungsHubShell } from "@/features/umsetzung/components/umsetzungs-hub-shell";

/**
 * Umsetzungs-Hub (Roadmap-P0 · Konsolidierungs-Skelett).
 *
 * Die Surface zieht in spaeteren Phasen die heute verstreuten Surfaces
 * (Features-Uebersicht, PI-Planning, RTE-Cockpit, Dependencies,
 * Impediments) in eine zentrale Hub-Sicht ein. Im aktuellen Stand ist
 * der Hub vor allem Einstieg fuer den PI-Workspace (Roadmap-P2) — die
 * Tab-Struktur listet die zugaenglichen PIs.
 */
export default async function UmsetzungsHubPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  // Scope-gefiltert ueber die ART-Scopes des Principals; leerer Scope
  // bedeutet „alle Tenant-ARTs".
  const scopedArtIds = principal.scopes.artIds;
  const [arts, pis] = await Promise.all([
    db.art.findMany({
      where: {
        tenantId: principal.tenantId,
        deletedAt: null,
        ...(scopedArtIds.length > 0 ? { id: { in: scopedArtIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        valueStream: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.programIncrement.findMany({
      where: {
        tenantId: principal.tenantId,
        ...(scopedArtIds.length > 0 ? { artId: { in: scopedArtIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        art: { select: { id: true, name: true } },
      },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <Suspense fallback={null}>
      <UmsetzungsHubShell
        arts={arts.map((a) => ({
          id: a.id,
          name: a.name,
          valueStreamName: a.valueStream?.name ?? null,
        }))}
        pis={pis.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.startDate,
          endDate: p.endDate,
          artName: p.art?.name ?? null,
        }))}
      />
    </Suspense>
  );
}
