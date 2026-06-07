import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listInitiativeHistory } from "@/server/services/initiative";
import { InitiativeLevel } from "@/domain/types";
import { buildFeatureDetailModel } from "@/server/views/feature-detail";
import { FeatureDetailShell } from "@/features/umsetzung/components/feature-detail-shell";
import type { DependencyEdge } from "@/features/umsetzung/components/feature-dependencies-tab";

/**
 * Feature-Detail-Page (Roadmap-P1.A · Overview + P1.B · Dependencies,
 * Acceptance, History).
 *
 * Loader laedt Feature + Parent + ART + Value-Stream + PI + Owner-Label
 * fuer das Page-Model, dazu Dependencies (in + out), Kandidaten fuer
 * den Link-Dialog (Features im selben ART) und die Audit-History.
 */
export default async function FeatureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const feature = await db.initiative.findFirst({
    where: {
      id,
      tenantId: principal.tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      parentId: true,
      artId: true,
      ownerId: true,
      wsjfBusinessValue: true,
      wsjfTimeCriticality: true,
      wsjfRiskReduction: true,
      wsjfJobSize: true,
      wsjfComputed: true,
      acceptanceCriteria: true,
      createdAt: true,
      updatedAt: true,
      parent: {
        select: { id: true, title: true, stageGate: true, valueStreamId: true },
      },
      art: {
        select: { id: true, name: true, valueStreamId: true },
      },
      pi: { select: { id: true, name: true } },
    },
  });

  if (!feature) notFound();

  const valueStreamId = feature.parent?.valueStreamId ?? feature.art?.valueStreamId ?? null;

  const [valueStream, userLabels, dependenciesOut, dependenciesIn, history, artFeatures] =
    await Promise.all([
      valueStreamId
        ? db.valueStream.findFirst({
            where: { id: valueStreamId, tenantId: principal.tenantId, deletedAt: null },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      listTenantUserLabels(db, principal.tenantId),
      db.dependency.findMany({
        where: { tenantId: principal.tenantId, fromId: feature.id },
        select: {
          id: true,
          type: true,
          to: { select: { id: true, title: true } },
        },
      }),
      db.dependency.findMany({
        where: { tenantId: principal.tenantId, toId: feature.id },
        select: {
          id: true,
          type: true,
          from: { select: { id: true, title: true } },
        },
      }),
      listInitiativeHistory(db, principal.tenantId, feature.id),
      // Andere Features im selben ART als Link-Kandidaten (ohne sich selbst).
      feature.artId
        ? db.initiative.findMany({
            where: {
              tenantId: principal.tenantId,
              level: InitiativeLevel.FEATURE,
              artId: feature.artId,
              deletedAt: null,
              NOT: { id: feature.id },
            },
            select: { id: true, title: true },
            orderBy: { title: "asc" },
          })
        : Promise.resolve([]),
    ]);

  const model = buildFeatureDetailModel({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    status: feature.status,
    parentId: feature.parentId,
    parentTitle: feature.parent?.title ?? null,
    parentStageGate: feature.parent?.stageGate ?? null,
    artId: feature.artId,
    artName: feature.art?.name ?? null,
    valueStreamId: valueStream?.id ?? null,
    valueStreamName: valueStream?.name ?? null,
    piId: feature.pi?.id ?? null,
    piName: feature.pi?.name ?? null,
    ownerLabel: feature.ownerId ? (userLabels[feature.ownerId] ?? null) : null,
    wsjfBusinessValue: feature.wsjfBusinessValue,
    wsjfTimeCriticality: feature.wsjfTimeCriticality,
    wsjfRiskReduction: feature.wsjfRiskReduction,
    wsjfJobSize: feature.wsjfJobSize,
    wsjfComputed: feature.wsjfComputed != null ? Number(feature.wsjfComputed) : null,
    acceptanceCriteria: feature.acceptanceCriteria,
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
  });

  const canEdit = hasCapability(principal, "feature.update", {
    tenantId: principal.tenantId,
    artId: feature.artId,
  });
  const canTransition = hasCapability(principal, "feature.delivery.set", {
    tenantId: principal.tenantId,
    artId: feature.artId,
  });
  const canLinkDependency = hasCapability(principal, "dependency.link", {
    tenantId: principal.tenantId,
    artId: feature.artId,
  });

  const outgoing: DependencyEdge[] = dependenciesOut.map((d) => ({
    id: d.id,
    type: d.type as DependencyEdge["type"],
    other: { id: d.to.id, title: d.to.title },
  }));
  const incoming: DependencyEdge[] = dependenciesIn.map((d) => ({
    id: d.id,
    type: d.type as DependencyEdge["type"],
    other: { id: d.from.id, title: d.from.title },
  }));

  // Kandidaten fuer den Link-Dialog: existierende Out-Targets ausschliessen,
  // damit der Picker keine Duplikate vorschlaegt.
  const existingTargetIds = new Set(outgoing.map((e) => e.other.id));
  const candidates = artFeatures.filter((f) => !existingTargetIds.has(f.id));

  const historyEvents = history.map((h) => ({
    id: h.id,
    action: h.action,
    occurredAt: h.occurredAt.toISOString(),
    ...(h.actorId ? { actorId: h.actorId } : {}),
  }));

  return (
    <Suspense fallback={null}>
      <FeatureDetailShell
        model={model}
        canEdit={canEdit}
        canTransition={canTransition}
        canLinkDependency={canLinkDependency}
        outgoing={outgoing}
        incoming={incoming}
        candidates={candidates}
        historyEvents={historyEvents}
        userLabels={userLabels}
        {...(tab !== undefined ? { activeTab: tab } : {})}
      />
    </Suspense>
  );
}
