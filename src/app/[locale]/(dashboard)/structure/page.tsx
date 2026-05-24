import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
  getStructureMetrics,
} from "@/server/services/structure";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/domain/operating-model";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { StructureOverview } from "@/features/structure/components/structure-overview";
import { StructureTree } from "@/features/structure/components/structure-tree";
import { StructureTimeline } from "@/features/structure/components/structure-timeline";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

const TABS: readonly DetailTab[] = [
  { key: "overview", label: "Übersicht" },
  { key: "timeline", label: "Timeline" },
  { key: "arts", label: "ARTs" },
];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Structure hub — the single home for the portfolio's underlying organisation.
 * A tabbed shell (like the Epic page): Übersicht (value streams + counts),
 * Timeline (PI cadence + calendar), ARTs (ARTs with their teams).
 */
export default async function StructurePage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const activeTab = resolveTab(TABS, tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const isAdmin =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  const canCreateVs = isAdmin || principal.roles.includes("portfolio_manager");

  let content: ReactNode;
  if (activeTab === "timeline") {
    const timeline = await getStructureTimeline(db, principal.tenantId);
    content = (
      <StructureTimeline timeline={timeline} canEditCadence={isAdmin} canCreatePi={isAdmin} />
    );
  } else if (activeTab === "overview") {
    const [tree, userLabels, metrics, targetModel] = await Promise.all([
      getStructureTree(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      getStructureMetrics(db, principal.tenantId),
      getActiveTargetModel(db, principal.tenantId),
    ]);
    content = (
      <StructureOverview
        tree={tree}
        userLabels={userLabels}
        epicsByValueStream={metrics.epicsByValueStream}
        activePiCount={metrics.activePiCount}
        canCreateVs={canCreateVs}
        practices={effectivePractices(targetModel)}
      />
    );
  } else {
    const [tree, userLabels] = await Promise.all([
      getStructureTree(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
    ]);
    content = (
      <StructureTree
        tree={tree}
        userLabels={userLabels}
        canCreateVs={canCreateVs}
        canCreateArt={isAdmin}
        canCreateTeam={isAdmin}
      />
    );
  }

  return (
    <EntityDetailShell title="Struktur" tabs={TABS} activeTab={activeTab} basePath="/structure">
      {content}
    </EntityDetailShell>
  );
}
