/**
 * Portfolio dashboard — read-only loader for the economics view. Pulls each
 * Epic's business-case cost slices + benefits and resolves a calendar cost
 * start from its timeline, then returns a serialisable DTO. The actual month
 * bucketing and aggregation happen client-side (so the Projekt-ID / Stichtag
 * slicers react instantly) via the pure `@/domain/portfolio-economics` module.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import { parseKpiMeasurements } from "@/domain/kpi";
import { isoDay, monthStart, addMonths } from "@/domain/calendar";
import { deriveEpicEconomics } from "@/domain/epic-economics";
import type { EpicEconomicsDTO, PortfolioEconomicsData } from "@/domain/portfolio-economics";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

// The serialisable DTO contract lives with the economics maths it feeds; re-
// exported so existing importers (the dashboard client) keep their path.
export type {
  BenefitKpiDTO,
  EpicEconomicsDTO,
  PortfolioEconomicsData,
} from "@/domain/portfolio-economics";

/** Reads a JSON map of period-key → number, discarding malformed entries. */
function parseAmountMap(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/**
 * Loads the portfolio economics inputs for a tenant. Cost amounts and benefits
 * come from `businessCase`; the cost-start month is resolved from `timeline`
 * (timeline-first fallback chain in `resolveCostStart`). The horizon end is the
 * tenant setting, or — when unset — three years past the last go-live so the
 * recurring benefit has room to play out.
 */
export async function getPortfolioEconomics(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioEconomicsData> {
  const [rows, tenant] = await Promise.all([
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      select: {
        id: true,
        title: true,
        businessCase: true,
        timeline: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        createdAt: true,
        valueStream: { select: { name: true } },
        kpis: {
          select: {
            id: true,
            name: true,
            baseline: true,
            target: true,
            measurements: true,
            benefitWeight: true,
          },
        },
        budgetAllocation: { select: { allocations: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { costNeutralTarget: true, dashboardHorizonEnd: true },
    }),
  ]);

  const epics: EpicEconomicsDTO[] = rows.map((row) => {
    const view = deriveEpicEconomics({
      businessCase: row.businessCase,
      timeline: row.timeline,
      businessCaseApprovedAt: row.businessCaseApprovedAt,
      hypothesisApprovedAt: row.hypothesisApprovedAt,
      createdAt: row.createdAt,
      kpis: row.kpis.map((k) => ({
        id: k.id,
        name: k.name,
        baseline: k.baseline === null ? null : Number(k.baseline),
        target: k.target === null ? null : Number(k.target),
        measurements: parseKpiMeasurements(k.measurements),
        benefitWeight: k.benefitWeight === null ? null : Number(k.benefitWeight),
      })),
    });

    return {
      id: row.id,
      title: row.title,
      valueStream: row.valueStream?.name ?? null,
      costSlices: view.costSlices,
      oneTimeBenefit: view.oneTimeBenefit,
      recurringBenefit: view.recurringBenefit,
      costStartIso: isoDay(view.costStart),
      goLiveIso: isoDay(view.goLive),
      hasBusinessCase: view.hasBusinessCase,
      benefitKpis: view.benefitKpis,
      hasAllocation: row.budgetAllocation != null,
      allocatedByPeriod: parseAmountMap(row.budgetAllocation?.allocations),
    };
  });

  // Axis lower bound: earliest cost start (fallback: today's month).
  const starts = epics.map((e) => new Date(`${e.costStartIso}T00:00:00.000Z`));
  const axisFrom = starts.length
    ? starts.reduce((min, d) => (d < min ? d : min), starts[0]!)
    : monthStart(new Date());

  // Horizon end: tenant setting, else three years past the latest go-live.
  let horizonEnd: Date;
  if (tenant?.dashboardHorizonEnd) {
    horizonEnd = monthStart(tenant.dashboardHorizonEnd);
  } else if (epics.length) {
    const lastGoLive = epics
      .map((e) => new Date(`${e.goLiveIso}T00:00:00.000Z`))
      .reduce((max, d) => (d > max ? d : max), axisFrom);
    horizonEnd = addMonths(lastGoLive, 36);
  } else {
    horizonEnd = addMonths(axisFrom, 12);
  }

  return {
    epics,
    axisFromIso: isoDay(axisFrom),
    horizonEndIso: isoDay(horizonEnd),
    costNeutralTarget: tenant?.costNeutralTarget != null ? Number(tenant.costNeutralTarget) : null,
  };
}

export interface SaveDashboardSettingsInput {
  /** Self-funding threshold per month; null clears it. */
  costNeutralTarget: number | null;
  /** Recurring-benefit accrual end (ISO `yyyy-mm-dd`); null clears it. */
  horizonEndIso: string | null;
}

/** Persists the two configurable Portfolio Dashboard settings on the tenant. */
export async function savePortfolioDashboardSettings(
  ctx: RequestContext,
  input: SaveDashboardSettingsInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.tenant.update({
      where: { id: mctx.tenantId },
      data: {
        costNeutralTarget: input.costNeutralTarget,
        dashboardHorizonEnd: input.horizonEndIso
          ? new Date(`${input.horizonEndIso}T00:00:00.000Z`)
          : null,
      },
    });
    return ok({
      result: { id: mctx.tenantId },
      audit: { action: "tenant.updated", resourceType: "tenant", resourceId: mctx.tenantId },
    });
  });
}
