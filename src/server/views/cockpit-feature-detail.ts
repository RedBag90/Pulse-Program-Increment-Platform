import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { InitiativeLevel } from "@/domain/types";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listInitiativeHistory } from "@/server/services/initiative";
import { buildFeatureDetailModel, type FeatureDetailModel } from "@/server/views/feature-detail";
import type { DependencyEdge } from "@/features/umsetzung/components/feature-dependencies-tab";
import type { ActivityItem } from "@/components/detail/initiative-activity-sidebar";

/**
 * Lade alle Felder, die der Feature-Slide-Over (oder die /umsetzung/feature/[id]
 * Deeplink-Vollroute) braucht — Model + Permissions + Dependencies + History
 * + Linkkandidaten + UserLabels. Sammelt mehrere Reads in einer
 * Promise.all-Welle und gibt ein flaches Bundle zurueck, das die Shell
 * direkt verbraucht.
 */
export interface CockpitFeatureDetail {
  model: FeatureDetailModel;
  canEdit: boolean;
  canTransition: boolean;
  canLinkDependency: boolean;
  outgoing: DependencyEdge[];
  incoming: DependencyEdge[];
  candidates: { id: string; title: string }[];
  historyEvents: ActivityItem[];
  userLabels: Record<string, string>;
}

export async function loadCockpitFeatureDetail(
  db: PrismaClient,
  principal: Principal,
  featureId: string,
): Promise<CockpitFeatureDetail | null> {
  const feature = await db.initiative.findFirst({
    where: {
      id: featureId,
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
      featureType: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { id: true, title: true, stageGate: true, valueStreamId: true } },
      art: { select: { id: true, name: true, valueStreamId: true } },
      pi: { select: { id: true, name: true } },
    },
  });
  if (!feature) return null;

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
        select: { id: true, type: true, to: { select: { id: true, title: true } } },
      }),
      db.dependency.findMany({
        where: { tenantId: principal.tenantId, toId: feature.id },
        select: { id: true, type: true, from: { select: { id: true, title: true } } },
      }),
      listInitiativeHistory(db, principal.tenantId, feature.id),
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
    featureType: feature.featureType,
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
  });

  const resource = { tenantId: principal.tenantId, artId: feature.artId };
  const canEdit = hasCapability(principal, "feature.update", resource);
  const canTransition = hasCapability(principal, "feature.delivery.set", resource);
  const canLinkDependency = hasCapability(principal, "dependency.link", resource);

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

  const existingTargetIds = new Set(outgoing.map((e) => e.other.id));
  const candidates = artFeatures.filter((f) => !existingTargetIds.has(f.id));

  const historyEvents: ActivityItem[] = history.map((h) => ({
    id: h.id,
    action: h.action,
    occurredAt: h.occurredAt.toISOString(),
    ...(h.actorId ? { actorId: h.actorId } : {}),
  }));

  return {
    model,
    canEdit,
    canTransition,
    canLinkDependency,
    outgoing,
    incoming,
    candidates,
    historyEvents,
    userLabels,
  };
}
