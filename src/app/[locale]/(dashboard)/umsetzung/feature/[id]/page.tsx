import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { InitiativeLevel } from "@/domain/types";
import { buildFeatureDetailModel } from "@/server/views/feature-detail";
import { FeatureDetailShell } from "@/features/umsetzung/components/feature-detail-shell";

/**
 * Feature-Detail-Page (Roadmap-P1.A · Overview-Tab).
 *
 * Heute existierte keine verlinkbare Feature-Detail-Seite — alle
 * Mutationen liefen ueber Modals. Diese Page schliesst die Luecke und
 * mountet das `FeatureDetailShell` mit dem Overview-Tab. Die anderen
 * drei Tabs (Dependencies, Acceptance, History) ziehen in P1.B nach.
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
  const valueStream = valueStreamId
    ? await db.valueStream.findFirst({
        where: { id: valueStreamId, tenantId: principal.tenantId, deletedAt: null },
        select: { id: true, name: true },
      })
    : null;

  const userLabels = await listTenantUserLabels(db, principal.tenantId);

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

  return (
    <Suspense fallback={null}>
      <FeatureDetailShell
        model={model}
        canEdit={canEdit}
        canTransition={canTransition}
        {...(tab !== undefined ? { activeTab: tab } : {})}
      />
    </Suspense>
  );
}
