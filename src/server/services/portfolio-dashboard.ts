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
import { parseBusinessCase, businessCaseHasContent } from "@/domain/business-case";
import { parseKpiMeasurements, type KpiMeasurement } from "@/domain/kpi";
import { parseTimeline } from "@/domain/timeline";
import {
  resolveCostStart,
  resolveGoLive,
  monthStart,
  addMonths,
} from "@/domain/portfolio-economics";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

/** A KPI driving the recurring benefit, with its share and measurement history. */
export interface BenefitKpiDTO {
  kpiId: string;
  name: string;
  /** Share of the recurring benefit (fraction 0..1). */
  weight: number;
  baseline: number | null;
  target: number | null;
  measurements: KpiMeasurement[];
}

/** One Epic's economics, serialisable (dates as ISO `yyyy-mm-dd`). */
export interface EpicEconomicsDTO {
  id: string;
  title: string;
  valueStream: string | null;
  costSlices: number[];
  oneTimeBenefit: number;
  recurringBenefit: number;
  /** Resolved cost-start month — Backlog milestone (ISO date). */
  costStartIso: string;
  /** Resolved go-live / completion month — Implementation milestone (ISO date). */
  goLiveIso: string;
  /** Whether the Epic carries any business-case content (else flows are 0). */
  hasBusinessCase: boolean;
  /**
   * Linked KPIs (with weights + history) that realise the recurring benefit.
   * Empty → the dashboard uses the flat-forecast fallback.
   */
  benefitKpis: BenefitKpiDTO[];
  /** True when a participatory-budgeting allocation exists → costs come from it. */
  hasAllocation: boolean;
  /** Allocated budget per half-year key (the budgeting decision). */
  allocatedByPeriod: Record<string, number>;
}

export interface PortfolioEconomicsData {
  epics: EpicEconomicsDTO[];
  /** Earliest cost start across all Epics (axis lower bound, ISO date). */
  axisFromIso: string;
  /** Recurring-benefit accrual end / axis upper bound (ISO date). */
  horizonEndIso: string;
  /** Configurable self-funding threshold per month, or null if unset. */
  costNeutralTarget: number | null;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

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
    const bc = parseBusinessCase(row.businessCase).current;
    const timeline = parseTimeline(row.timeline);
    const costStart = resolveCostStart({
      timeline,
      businessCaseApprovedAt: row.businessCaseApprovedAt,
      hypothesisApprovedAt: row.hypothesisApprovedAt,
      createdAt: row.createdAt,
    });
    const costSlices = (bc.costSlices ?? []).map((s) => s.amount ?? 0);
    const goLive = resolveGoLive(timeline, costStart, costSlices.length);

    // Which KPIs realise the recurring benefit, and at what share (fraction)?
    // The share is the KPI's own `benefitWeight` (set on the KPI tab):
    //  - Some KPI has a weight → use the weights literally (unweighted KPIs = 0).
    //  - No KPI weighted but the Epic has KPIs → split equally (one KPI → 100 %).
    //  - No KPIs at all → empty → the dashboard uses the flat-forecast fallback.
    const toDto = (k: (typeof row.kpis)[number], weight: number): BenefitKpiDTO => ({
      kpiId: k.id,
      name: k.name,
      weight,
      baseline: k.baseline === null ? null : Number(k.baseline),
      target: k.target === null ? null : Number(k.target),
      measurements: parseKpiMeasurements(k.measurements),
    });
    const anyWeighted = row.kpis.some((k) => k.benefitWeight !== null);
    let benefitKpis: BenefitKpiDTO[];
    if (anyWeighted) {
      benefitKpis = row.kpis.map((k) =>
        toDto(k, k.benefitWeight === null ? 0 : Number(k.benefitWeight)),
      );
    } else if (row.kpis.length > 0) {
      const equal = 1 / row.kpis.length;
      benefitKpis = row.kpis.map((k) => toDto(k, equal));
    } else {
      benefitKpis = [];
    }

    return {
      id: row.id,
      title: row.title,
      valueStream: row.valueStream?.name ?? null,
      costSlices,
      oneTimeBenefit: bc.oneTimeBenefit ?? 0,
      recurringBenefit: bc.recurringBenefit ?? 0,
      costStartIso: isoDay(costStart),
      goLiveIso: isoDay(goLive),
      hasBusinessCase: businessCaseHasContent(bc),
      benefitKpis,
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
