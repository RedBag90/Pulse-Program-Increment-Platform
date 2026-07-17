import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { buildImpedimentsOverviewModel } from "@/server/views/impediments-overview";
import { ImpedimentsOverviewShell } from "@/features/risks/components/impediments-overview-shell";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { Page } from "@/components/layout";

/**
 * Cross-ART Impediments-Overview mit ROAM-Funnel als primärer Achse.
 * Scope: alle ARTs des Principals (oder alle im Tenant, wenn
 * `scopes.artIds` leer = "alle").
 */
export default async function ImpedimentsOverviewPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tenantId = principal.tenantId;

  const scopedArtIds = principal.scopes.artIds;
  const artWhere =
    scopedArtIds.length > 0
      ? { id: { in: scopedArtIds }, tenantId, deletedAt: null }
      : { tenantId, deletedAt: null };

  const arts = await db.art.findMany({
    where: artWhere,
    select: { id: true, name: true },
  });
  const artIds = arts.map((a) => a.id);

  if (artIds.length === 0) {
    return (
      <Page>
        <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            Keine ARTs im Zugriff. Bitte einen Admin um Scope-Zuweisung.
          </p>
        </div>
      </Page>
    );
  }

  const [impediments, pis] = await Promise.all([
    db.impediment.findMany({
      where: { tenantId, artId: { in: artIds } },
      orderBy: { createdAt: "desc" },
    }),
    db.programIncrement.findMany({
      where: { tenantId, artId: { in: artIds } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  const userLabels = await listTenantUserLabels(db, tenantId);

  // PI-IDs dedupliziert (Timeline-geteilt).
  const seen = new Set<string>();
  const piOptions = pis.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const model = buildImpedimentsOverviewModel({
    impediments,
    arts,
    pis: piOptions,
    userLabels,
  });

  // Bulk darf, wer im aktuellen Scope mindestens eine ART hat, in der
  // `impediment.resolve` greift — wir prüfen optimistisch auf eine
  // beliebige ART; pro Bulk-Aufruf prüft die Action erneut.
  const sampleArtId = artIds[0]!;
  const canBulk = hasCapability(principal, "impediment.resolve", {
    tenantId,
    artId: sampleArtId,
  });

  return (
    <Suspense fallback={null}>
      <ImpedimentsOverviewShell model={model} canBulk={canBulk} />
    </Suspense>
  );
}
