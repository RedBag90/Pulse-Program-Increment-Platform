import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getArt } from "@/server/services/art";
import { listFeatures } from "@/server/services/feature";
import { listEpics } from "@/server/services/epic";
import { getTenantPractices } from "@/server/services/target-model";
import { ArtSubNav } from "@/features/art/components/art-sub-nav";
import { buildFeaturesListModel } from "@/server/views/features-list";
import { FeaturesListShell } from "@/features/art/components/features-list-shell";
import type { ArtId } from "@/domain/types";

interface Props {
  params: Promise<{ artId: string }>;
}

/**
 * Feature backlog — rich filterable list with a funnel header (status) +
 * multi-facet filter bar + bulk PI-assignment via the existing
 * setFeaturePiAction batch action. Replaces the old flat HTML table.
 */
export default async function FeaturesPage({ params }: Props) {
  const { artId } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [art, { items: features }, epics, pis, practices] = await Promise.all([
    getArt(db, principal.tenantId, artId as ArtId),
    listFeatures(db, principal.tenantId, artId as ArtId),
    listEpics(db, principal.tenantId),
    db.programIncrement.findMany({
      where: { tenantId: principal.tenantId, artId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, status: true },
    }),
    getTenantPractices(db, principal.tenantId),
  ]);

  if (!art) notFound();

  // Identify which features are the target of any `blocks` dependency —
  // drives the inline "🛑 Blockiert" badge on the row.
  const featureIds = features.map((f) => f.id);
  const blockingDeps =
    featureIds.length === 0
      ? []
      : await db.dependency.findMany({
          where: {
            tenantId: principal.tenantId,
            type: "blocks",
            toId: { in: featureIds },
          },
          select: { toId: true },
        });
  const blockedFeatureIds = new Set(blockingDeps.map((d) => d.toId));

  const canEdit = hasCapability(principal, "feature.update", {
    tenantId: principal.tenantId,
    artId,
  });

  const model = buildFeaturesListModel({
    features: features.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      piId: f.piId,
      parent: f.parent,
      pi: f.pi,
      wsjfBusinessValue: f.wsjfBusinessValue,
      wsjfTimeCriticality: f.wsjfTimeCriticality,
      wsjfRiskReduction: f.wsjfRiskReduction,
      wsjfJobSize: f.wsjfJobSize,
      wsjfComputed: f.wsjfComputed != null ? Number(f.wsjfComputed) : null,
      acceptanceCriteria: f.acceptanceCriteria,
      createdAt: f.createdAt,
    })),
    epics: epics.map((e) => ({ id: e.id, title: e.title })),
    pis,
    blockedFeatureIds,
    showWsjf: practices.wsjf,
  });

  return (
    <main className="p-0 space-y-4">
      <ArtSubNav artId={artId} artName={art.name} />
      <Suspense fallback={null}>
        <FeaturesListShell model={model} artId={artId} canEdit={canEdit} />
      </Suspense>
    </main>
  );
}
