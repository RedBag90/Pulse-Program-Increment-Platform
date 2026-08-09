import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { buildDependenciesOverviewModel } from "@/server/views/dependencies-overview";
import { DependenciesOverviewShell } from "@/modules/drumbeat/features/dependencies/components/dependencies-overview-shell";
import { Page } from "@/components/layout";

/**
 * Cross-PI Abhängigkeits-Übersicht. Scope: alle Dependencies, deren
 * From- oder To-Endpunkt ein Feature in einem ART im Zugriff des
 * Principals ist.
 */
export default async function DependenciesOverviewPage() {
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

  // Features in den scoped ARTs holen — sie sind die From/To-Endpunkte.
  const features = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      artId: { in: artIds },
    },
    select: { id: true, title: true, status: true, artId: true, piId: true },
  });
  const featureIds = features.map((f) => f.id);

  if (featureIds.length === 0) {
    return (
      <Suspense fallback={null}>
        <DependenciesOverviewShell
          model={{
            rows: [],
            funnelCounts: { blocks: 0, depends_on: 0, relates_to: 0 },
            artOptions: [],
            piOptions: [],
            toStatusOptions: [],
          }}
          canBulk={false}
        />
      </Suspense>
    );
  }

  const [dependencies, pis] = await Promise.all([
    db.dependency.findMany({
      where: {
        tenantId,
        OR: [{ fromId: { in: featureIds } }, { toId: { in: featureIds } }],
      },
      orderBy: { createdAt: "desc" },
    }),
    db.programIncrement.findMany({
      where: { tenantId, artId: { in: artIds } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  // Bei Cross-Feature-IDs könnten Endpunkte in Features eines ARTs ausserhalb
  // des Scopes landen — die Anzeige zeigt sie als Endpunkte mit dem Namen
  // ihres tatsächlichen ARTs / PIs.
  const externalFeatureIds = [
    ...new Set([...dependencies.map((d) => d.fromId), ...dependencies.map((d) => d.toId)]),
  ].filter((id) => !featureIds.includes(id));
  const externalFeatures =
    externalFeatureIds.length > 0
      ? await db.initiative.findMany({
          where: {
            tenantId,
            id: { in: externalFeatureIds },
            level: InitiativeLevel.FEATURE,
            deletedAt: null,
          },
          select: { id: true, title: true, status: true, artId: true, piId: true },
        })
      : [];

  // Dazugehörige fremde ARTs/PIs nachladen (für die Endpoint-Labels).
  const externalArtIds = [
    ...new Set(externalFeatures.map((f) => f.artId).filter((id): id is string => !!id)),
  ];
  const externalPiIds = [
    ...new Set(externalFeatures.map((f) => f.piId).filter((id): id is string => !!id)),
  ];
  const [externalArts, externalPis] = await Promise.all([
    externalArtIds.length > 0
      ? db.art.findMany({
          where: { id: { in: externalArtIds }, tenantId },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    externalPiIds.length > 0
      ? db.programIncrement.findMany({
          where: { id: { in: externalPiIds }, tenantId },
          select: { id: true, name: true, status: true },
        })
      : Promise.resolve([] as { id: string; name: string; status: string }[]),
  ]);

  // Eindeutige PIs (gleicher Timeline-ID-Effekt wie bei Features).
  const seenPi = new Set<string>();
  const mergedPis = [...pis, ...externalPis].filter((p) => {
    if (seenPi.has(p.id)) return false;
    seenPi.add(p.id);
    return true;
  });
  const seenArt = new Set<string>();
  const mergedArts = [...arts, ...externalArts].filter((a) => {
    if (seenArt.has(a.id)) return false;
    seenArt.add(a.id);
    return true;
  });
  const allFeatures = [...features, ...externalFeatures];

  const model = buildDependenciesOverviewModel({
    dependencies,
    features: allFeatures,
    arts: mergedArts,
    pis: mergedPis,
  });

  const canBulk = hasCapability(principal, "dependency.unlink", {
    tenantId,
    artId: artIds[0]!,
  });

  return (
    <Suspense fallback={null}>
      <DependenciesOverviewShell model={model} canBulk={canBulk} />
    </Suspense>
  );
}
