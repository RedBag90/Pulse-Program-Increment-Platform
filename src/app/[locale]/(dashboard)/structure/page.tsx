import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  getStructureTree,
  getStructureTimeline,
  getStructureMetrics,
} from "@/server/services/structure";
import { getValueStreamBudgets, type ValueStreamBudgetData } from "@/server/services/budgeting";
import { listPiStandards } from "@/server/services/pi-standard";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getActiveTargetModel } from "@/server/services/target-model";
import { effectivePractices } from "@/domain/operating-model";
import { StructureOverview } from "@/features/structure/components/structure-overview";
import { StructureTree } from "@/features/structure/components/structure-tree";
import { StructureTimeline } from "@/features/structure/components/structure-timeline";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Valid `?tab=` values — the three sub-pages also surfaced as top-nav entries. */
const TAB_KEYS = ["overview", "timeline", "arts"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function resolveStructureTab(raw: string | undefined): TabKey {
  return (TAB_KEYS as readonly string[]).includes(raw ?? "") ? (raw as TabKey) : "overview";
}

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

/** Derived total allocated budget per Value Stream id (participatory budgeting). */
function budgetTotalsById(data: ValueStreamBudgetData): Record<string, number> {
  return Object.fromEntries(data.valueStreams.map((b) => [b.valueStreamId, b.total]));
}

/**
 * Structure hub — the single home for the portfolio's underlying organisation.
 * A tabbed shell (like the Epic page): Übersicht (value streams + counts),
 * Timeline (PI cadence + calendar), ARTs (ARTs with their teams).
 */
export default async function StructurePage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const activeTab = resolveStructureTab(tab);

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  // The Strukturbaum/Timeline-tab affordances (Edit Cadence, Add ART, Add Team)
  // are admin-only today. `hasCapability` with `timeline.manage` matches that
  // grant exactly (tenant_admin / portfolio_manager; platform_admin bypasses).
  const isAdmin = hasCapability(principal, "timeline.manage");
  const canCreateVs = hasCapability(principal, "value_stream.create");
  const canManageStandards = hasCapability(principal, "pi_standard.manage");

  let content: ReactNode;
  if (activeTab === "timeline") {
    const [timeline, standards] = await Promise.all([
      getStructureTimeline(db, principal.tenantId),
      listPiStandards(db, principal.tenantId),
    ]);
    content = (
      <StructureTimeline
        timeline={timeline}
        canEditCadence={isAdmin}
        canCreatePi={isAdmin}
        canManageStandards={canManageStandards}
        standards={standards}
      />
    );
  } else if (activeTab === "overview") {
    const [tree, userLabels, metrics, targetModel, vsBudgets] = await Promise.all([
      getStructureTree(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      getStructureMetrics(db, principal.tenantId),
      getActiveTargetModel(db, principal.tenantId),
      getValueStreamBudgets(db, principal.tenantId),
    ]);
    content = (
      <StructureOverview
        tree={tree}
        userLabels={userLabels}
        epicsByValueStream={metrics.epicsByValueStream}
        budgetTotals={budgetTotalsById(vsBudgets)}
        activePiCount={metrics.activePiCount}
        canCreateVs={canCreateVs}
        practices={effectivePractices(targetModel)}
      />
    );
  } else {
    const [tree, userLabels, vsBudgets] = await Promise.all([
      getStructureTree(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      getValueStreamBudgets(db, principal.tenantId),
    ]);
    content = (
      <StructureTree
        tree={tree}
        userLabels={userLabels}
        budgetTotals={budgetTotalsById(vsBudgets)}
        canCreateVs={canCreateVs}
        canCreateArt={isAdmin}
        canCreateTeam={isAdmin}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Struktur</h1>
      </header>
      <main className="min-w-0 flex-1 overflow-auto p-6">{content}</main>
    </div>
  );
}
