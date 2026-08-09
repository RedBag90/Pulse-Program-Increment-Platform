import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getTenantPractices } from "@/server/services/target-model";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { buildFeaturesOverviewModel } from "@/server/views/features-overview";
import { FeaturesOverviewShell } from "@/modules/drumbeat/features/implementation/components/features-overview-shell";
import { Page } from "@/components/layout";

/**
 * Cross-Value-Stream / Cross-ART Features-Übersicht. Lädt alle
 * Features, die der Principal sehen darf (Scope: `principal.scopes
 * .artIds`, leer = alle Tenant-ARTs), gemeinsam mit ihrem ART und
 * Wertstrom, und übergibt sie an die Filter-Shell.
 */
export default async function FeaturesOverviewPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const tenantId = principal.tenantId;

  const scopedArtIds = principal.scopes.artIds;
  const artWhere =
    scopedArtIds.length > 0
      ? { id: { in: scopedArtIds }, tenantId, deletedAt: null }
      : { tenantId, deletedAt: null };

  const [arts, valueStreams, practices] = await Promise.all([
    db.art.findMany({
      where: artWhere,
      select: { id: true, name: true, valueStreamId: true },
    }),
    db.valueStream.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true },
    }),
    getTenantPractices(db, tenantId),
  ]);

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

  const [features, epics, pis] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        artId: { in: artIds },
      },
      include: {
        parent: { select: { id: true, title: true } },
        pi: { select: { id: true, name: true } },
      },
      orderBy: [{ wsjfComputed: "desc" }, { createdAt: "asc" }],
    }),
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      select: { id: true, title: true },
    }),
    db.programIncrement.findMany({
      where: { tenantId, artId: { in: artIds } },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const featureIds = features.map((f) => f.id);
  const blockingDeps =
    featureIds.length === 0
      ? []
      : await db.dependency.findMany({
          where: { tenantId, type: "blocks", toId: { in: featureIds } },
          select: { toId: true },
        });
  const blockedFeatureIds = new Set(blockingDeps.map((d) => d.toId));

  // PI-IDs auf eindeutig reduzieren (timeline-geteilt → mehrfach gleiche
  // Namen für unterschiedliche ARTs); für den Filter reicht ein Eintrag.
  const seenPiIds = new Set<string>();
  const piOptions = pis.filter((p) => {
    if (seenPiIds.has(p.id)) return false;
    seenPiIds.add(p.id);
    return true;
  });

  const model = buildFeaturesOverviewModel({
    features: features.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      piId: f.piId,
      artId: f.artId,
      parent: f.parent,
      pi: f.pi,
      wsjfBusinessValue: f.wsjfBusinessValue,
      wsjfTimeCriticality: f.wsjfTimeCriticality,
      wsjfRiskReduction: f.wsjfRiskReduction,
      wsjfJobSize: f.wsjfJobSize,
      wsjfComputed: f.wsjfComputed != null ? Number(f.wsjfComputed) : null,
      acceptanceCriteria: f.acceptanceCriteria,
      createdAt: f.createdAt,
      featureType: f.featureType,
    })),
    arts,
    valueStreams,
    epics,
    pis: piOptions,
    blockedFeatureIds,
    showWsjf: practices.wsjf,
  });

  return (
    <Suspense fallback={null}>
      <FeaturesOverviewShell model={model} />
    </Suspense>
  );
}
