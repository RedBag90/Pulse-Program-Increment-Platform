/**
 * Portfolio dashboard — read-only loader for the economics view. Pulls each
 * Epic's business-case cost slices + benefits and resolves a calendar cost
 * start from its timeline, then returns a serialisable DTO. The actual month
 * bucketing and aggregation happen client-side (so the Projekt-ID / Stichtag
 * slicers react instantly) via the pure `@/domain/portfolio-economics` module.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok } from "@/modules/core/kernel/domain/errors";
import { parseKpiMeasurements } from "@/modules/core/kpi/domain/kpi";
import { isoDay, monthStart } from "@/modules/core/kernel/domain/calendar";
import { deriveEpicEconomics } from "@/modules/work/domain/epic-economics";
import { parsePeriodAmountMap } from "@/modules/core/kernel/domain/budget-period";
import type {
  EpicEconomicsDTO,
  PortfolioEconomicsData,
} from "@/modules/work/domain/portfolio-economics";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import type { Prisma } from "@/generated/prisma";
import {
  parseGuardrailTargetsDetailed,
  type GuardrailTargets,
} from "@/modules/work/domain/portfolio-guardrails";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";

// The serialisable DTO contract lives with the economics maths it feeds; re-
// exported so existing importers (the dashboard client) keep their path.
export type {
  BenefitKpiDTO,
  EpicEconomicsDTO,
  PortfolioEconomicsData,
} from "@/modules/work/domain/portfolio-economics";

/** Reads a JSON map of period-key → number, discarding malformed entries. */
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
            valuePerUnit: true,
            benefitKind: true,
            recurringInterval: true,
          },
        },
        budgetAllocation: { select: { allocations: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { costNeutralTarget: true, costPerJobSizePoint: true },
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
        valuePerUnit: k.valuePerUnit === null ? null : Number(k.valuePerUnit),
        benefitKind: k.benefitKind,
        recurringInterval: k.recurringInterval,
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
      allocatedByPeriod: parsePeriodAmountMap(row.budgetAllocation?.allocations),
    };
  });

  // Axis lower bound: earliest cost start (fallback: today's month).
  const starts = epics.map((e) => new Date(`${e.costStartIso}T00:00:00.000Z`));
  const axisFrom = starts.length
    ? starts.reduce((min, d) => (d < min ? d : min), starts[0]!)
    : monthStart(new Date());

  return {
    epics,
    axisFromIso: isoDay(axisFrom),
    costNeutralTarget: tenant?.costNeutralTarget != null ? Number(tenant.costNeutralTarget) : null,
    costPerJobSizePoint:
      tenant?.costPerJobSizePoint != null ? Number(tenant.costPerJobSizePoint) : null,
  };
}

/**
 * Laedt die Inputs fuer das SAFe-Guardrails-Page-Model (Roadmap-G4):
 * pro Epic die Klassifikation (epicType, investmentHorizon) und ein
 * "amount" — die Implementation-Cost aus dem Business Case, falls vorhanden.
 * Plus die Tenant-weiten Targets (Default bei null).
 */
export async function getPortfolioGuardrailsInputs(db: PrismaClient, tenantId: TenantId) {
  const [epics, tenant] = await Promise.all([
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      select: {
        id: true,
        title: true,
        epicType: true,
        investmentHorizon: true,
        businessCase: true,
        stageGate: true,
        needsSteeringAttention: true,
      },
    }),
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { guardrailTargets: true },
    }),
  ]);

  const epicInputs = epics.map((e) => {
    const totals = computeBusinessCaseTotals(parseBusinessCase(e.businessCase).current);
    const amount = totals.implementationCost > 0 ? totals.implementationCost : null;
    return {
      id: e.id,
      title: e.title,
      epicType: e.epicType,
      investmentHorizon: e.investmentHorizon,
      amount,
      stageGate: e.stageGate,
      needsSteeringAttention: e.needsSteeringAttention,
    };
  });

  // Defensive parse with provenance: corrupt tenant settings would otherwise
  // silently render as defaults and the dashboard would say "OK" while the
  // configured guardrails are actually unknown. We render with the safe
  // defaults *and* Sentry-warn so ops sees the drift.
  const parsed = parseGuardrailTargetsDetailed(tenant?.guardrailTargets ?? null);
  if (!parsed.cleanlyParsed) {
    void reportGuardrailTargetsFallback(tenantId, parsed.fellBackFields);
  }

  return { epics: epicInputs, targets: parsed.targets };
}

async function reportGuardrailTargetsFallback(
  tenantId: TenantId,
  fields: readonly string[],
): Promise<void> {
  const message = `[guardrails] tenant ${tenantId} has malformed guardrailTargets — fell back for: ${fields.join(", ")}`;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(message, { level: "warning", extra: { tenantId, fields } });
  } catch {
    process.stderr.write(`${message}\n`);
  }
}

export interface SaveDashboardSettingsInput {
  /** Self-funding threshold per month; null clears it. */
  costNeutralTarget: number | null;
  /** €/WSJF-Job-Size point for the PI-Planning capacity overlay; null hides the €-axis. */
  costPerJobSizePoint: number | null;
  /** SAFe Guardrails (Roadmap-G4). undefined = nicht anpacken. */
  guardrailTargets?: GuardrailTargets | undefined;
}

/** Persists the configurable Portfolio Dashboard settings on the tenant. */
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
        costPerJobSizePoint: input.costPerJobSizePoint,
        ...(input.guardrailTargets !== undefined && {
          guardrailTargets: input.guardrailTargets as unknown as Prisma.InputJsonValue,
        }),
      },
    });
    return ok({
      result: { id: mctx.tenantId },
      audit: { action: "tenant.updated", resourceType: "tenant", resourceId: mctx.tenantId },
    });
  });
}
