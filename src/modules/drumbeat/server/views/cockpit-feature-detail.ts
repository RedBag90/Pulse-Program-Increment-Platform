import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { listTenantApprovers } from "@/modules/work/server/services/epic-approval";
import { listInitiativeHistory } from "@/modules/core/kernel/server/initiative";
import { getBlockerWindowsForFeatures } from "@/modules/drumbeat/server/services/dependency";
import {
  earliestStartFromBlockers,
  type BlockerWindow,
} from "@/modules/core/kernel/domain/dependency-graph";
import {
  buildFeatureDetailModel,
  type FeatureDetailModel,
} from "@/modules/drumbeat/server/views/feature-detail";
import type { ActivityItem } from "@/components/detail/initiative-activity-sidebar";

/**
 * Eine Feature-Feature-Dependency-Kante aus Sicht *eines* Features. Der
 * Read-Model-Owner des Typs — die Client-Komponenten (Dependencies-Tab,
 * Detail-Shell) konsumieren ihn von hier (kein Server→Client-Typ-Import mehr).
 */
export interface DependencyEdge {
  id: string;
  type: "blocks" | "depends_on" | "relates_to";
  /** Das andere Ende der Kante (nicht das aktuelle Feature). */
  other: { id: string; title: string };
}

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
  /** `feature.owner.assign` — wertstrom-genau, nicht nur ART-weit. */
  canAssignOwner: boolean;
  /** Auswählbare Personen für den Owner-Picker. */
  approvers: { userId: string; roles: string[] }[];
  canLinkDependency: boolean;
  outgoing: DependencyEdge[];
  incoming: DependencyEdge[];
  candidates: { id: string; title: string }[];
  historyEvents: ActivityItem[];
  userLabels: Record<string, string>;
  /** Ein-Hop-Blocker-Fenster fuer den Fruehester-Start-Header im Deps-Tab. */
  blockerWindows: BlockerWindow[];
  /** Abgeleiteter fruehester Start + noch ungeplante Blocker. */
  blockerSummary: { earliest: Date | null; unscheduledBlockers: string[] };
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
      stageGate: true,
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
      pi: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
  });
  if (!feature) return null;

  const valueStreamId = feature.parent?.valueStreamId ?? feature.art?.valueStreamId ?? null;

  const [
    valueStream,
    userLabels,
    approvers,
    dependenciesOut,
    dependenciesIn,
    history,
    artFeatures,
    blockerMap,
  ] = await Promise.all([
    valueStreamId
      ? db.valueStream.findFirst({
          where: { id: valueStreamId, tenantId: principal.tenantId, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    listTenantUserLabels(db, principal.tenantId),
    // Auswahlkandidaten für den Owner-Picker — dieselbe Quelle wie beim Epic.
    listTenantApprovers(db, principal.tenantId),
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
    getBlockerWindowsForFeatures(db, principal.tenantId, [feature.id]),
  ]);

  const model = buildFeatureDetailModel({
    id: feature.id,
    title: feature.title,
    description: feature.description,
    status: feature.status,
    stageGate: feature.stageGate,
    parentId: feature.parentId,
    parentTitle: feature.parent?.title ?? null,
    parentStageGate: feature.parent?.stageGate ?? null,
    artId: feature.artId,
    artName: feature.art?.name ?? null,
    valueStreamId: valueStream?.id ?? null,
    valueStreamName: valueStream?.name ?? null,
    piId: feature.pi?.id ?? null,
    piName: feature.pi?.name ?? null,
    piStartDate: feature.pi?.startDate ?? null,
    piEndDate: feature.pi?.endDate ?? null,
    ownerId: feature.ownerId,
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
  // Eigene Ressource: der Wertstrom entscheidet, ob ein Wertstrom-Verantwortlicher
  // zuweisen darf — `resource` oben trägt nur den ART.
  const canAssignOwner = hasCapability(principal, "feature.owner.assign", {
    tenantId: principal.tenantId,
    artId: feature.artId,
    ...(valueStream?.id ? { valueStreamId: valueStream.id } : {}),
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

  const existingTargetIds = new Set(outgoing.map((e) => e.other.id));
  const candidates = artFeatures.filter((f) => !existingTargetIds.has(f.id));

  const historyEvents: ActivityItem[] = history.map((h) => ({
    id: h.id,
    action: h.action,
    occurredAt: h.occurredAt.toISOString(),
    ...(h.actorId ? { actorId: h.actorId } : {}),
  }));

  const blockerWindows = blockerMap.get(feature.id) ?? [];
  const blockerSummary = earliestStartFromBlockers(blockerWindows);

  return {
    model,
    canEdit,
    canTransition,
    canAssignOwner,
    approvers,
    canLinkDependency,
    outgoing,
    incoming,
    candidates,
    historyEvents,
    userLabels,
    blockerWindows,
    blockerSummary,
  };
}
