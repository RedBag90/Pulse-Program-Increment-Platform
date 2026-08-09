import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import {
  listEpicsForPortfolioList,
  countEpicChildFeatures,
  countEpicCompletedChildFeatures,
} from "@/modules/work/server/services/epic";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { getTenantPractices } from "@/server/services/target-model";
import { buildEpicsListModel } from "@/modules/work/server/views/portfolio-epics-list";
import { EpicsListShell } from "@/features/portfolio/components/epics-list-shell";

/** A KPI measurement entry as stored in the `measurements` JSON column. */
interface KpiMeasurement {
  date?: string;
  value?: number;
}

/**
 * Pick the latest measurement's value (chronologically). KPIs without any
 * measurement have no current value yet, so progress is rendered as "—".
 */
function latestMeasurement(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const items = raw as KpiMeasurement[];
  let bestDate = "";
  let bestValue: number | null = null;
  for (const m of items) {
    if (typeof m.value !== "number") continue;
    const d = typeof m.date === "string" ? m.date : "";
    if (d >= bestDate) {
      bestDate = d;
      bestValue = m.value;
    }
  }
  return bestValue;
}

/**
 * Portfolio epics list — the rich filterable surface portfolio managers,
 * and epic owners use to scan and steer the investment funnel. Loads
 * epics + KPIs + approvals in one query, child-feature counts in a tiny
 * groupBy, then hands everything to the URL-state shell. Permission gates
 * for inline mutations (`epic.update`, `epic.approve`) pass straight
 * through.
 */
export default async function EpicsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [epics, featureCounts, completedFeatureCounts, valueStreams, userLabels, practices] =
    await Promise.all([
      listEpicsForPortfolioList(db, principal.tenantId),
      countEpicChildFeatures(db, principal.tenantId),
      countEpicCompletedChildFeatures(db, principal.tenantId),
      listValueStreams(db, principal.tenantId),
      listTenantUserLabels(db, principal.tenantId),
      getTenantPractices(db, principal.tenantId),
    ]);

  const canEdit = hasCapability(principal, "epic.update");
  // Advancing a stage gate (single + batch) mirrors the `epic.approve` policy.
  const canAdvance = hasCapability(principal, "epic.approve");

  const model = buildEpicsListModel({
    epics: epics.map((e) => ({
      id: e.id,
      title: e.title,
      stageGate: e.stageGate,
      status: e.status,
      approvalPhase: e.approvalPhase,
      approvalRevision: e.approvalRevision,
      ownerId: e.ownerId,
      valueStream: e.valueStream,
      needsSteeringAttention: e.needsSteeringAttention,
      stagedForBudgeting: e.stagedForBudgeting,
      businessCase: e.businessCase,
      benefitHypothesis: e.benefitHypothesis,
      businessCaseApprovedAt: e.businessCaseApprovedAt,
      plannedStartAt: e.plannedStartAt,
      plannedEndAt: e.plannedEndAt,
      createdAt: e.createdAt,
      kpis: e.kpis
        .filter((k) => k.target != null)
        .map((k) => ({
          baseline: k.baseline != null ? Number(k.baseline) : null,
          target: Number(k.target),
          current: latestMeasurement(k.measurements),
          valuePerUnit: k.valuePerUnit != null ? Number(k.valuePerUnit) : null,
          benefitKind: k.benefitKind,
          recurringInterval: k.recurringInterval,
        })),
      epicApprovals: e.epicApprovals,
      childFeatureCount: featureCounts.get(e.id) ?? 0,
      completedChildFeatureCount: completedFeatureCounts.get(e.id) ?? 0,
      epicType: e.epicType,
      investmentHorizon: e.investmentHorizon,
    })),
    valueStreams,
    userLabels,
    stageGatesEnabled: practices.stageGates,
  });

  return (
    // `useSearchParams` reads dynamic URL state; Suspense satisfies Next.js's
    // boundary requirement around it.
    <Suspense fallback={null}>
      <EpicsListShell
        model={model}
        canEdit={canEdit}
        canAdvance={canAdvance}
        tenantId={principal.tenantId}
      />
    </Suspense>
  );
}
