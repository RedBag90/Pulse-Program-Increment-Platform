/**
 * Participatory budgeting service — loads the budgeting board (Epics staged for
 * the next budget meeting that have an approved hypothesis or business case),
 * and persists the pool, per-Epic allocations, and scheduling. The half-year
 * maths live in the pure `@/domain/budgeting` module.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import { parseTimeline } from "@/domain/timeline";
import { scheduleFromFundedWindow, withScheduleEstimates } from "@/domain/epic-schedule";
import { deriveEpicEconomics } from "@/domain/epic-economics";
import { halfYearKey, parseHalfYearKey, halfYearStart, addHalfYears } from "@/domain/calendar";
import { buildHalfYearAxis, type BudgetEpicView } from "@/domain/budgeting";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

export interface BudgetingBoardData {
  epics: BudgetEpicView[];
  periods: { key: string; label: string }[];
  /** Total budget pool per half-year key. */
  pool: Record<string, number>;
}

/** Reads a JSON map of period-key → number, discarding malformed entries. */
function parsePeriodMap(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Loads the budgeting board: eligible Epics + their need/allocation + the pool. */
export async function getBudgetingBoard(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingBoardData> {
  const [rows, tenant] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        OR: [{ hypothesisApprovedAt: { not: null } }, { businessCaseApprovedAt: { not: null } }],
      },
      select: {
        id: true,
        title: true,
        businessCase: true,
        timeline: true,
        businessCaseApprovedAt: true,
        hypothesisApprovedAt: true,
        createdAt: true,
        valueStream: { select: { id: true, name: true } },
        budgetAllocation: {
          select: { priority: true, hypothesisBudget: true, allocations: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { budgetPoolByPeriod: true } }),
  ]);

  const epics: BudgetEpicView[] = rows.map((row) => {
    const view = deriveEpicEconomics({
      businessCase: row.businessCase,
      timeline: row.timeline,
      businessCaseApprovedAt: row.businessCaseApprovedAt,
      hypothesisApprovedAt: row.hypothesisApprovedAt,
      createdAt: row.createdAt,
      kpis: [], // budgeting does not use KPI-driven benefit
    });
    const alloc = row.budgetAllocation;
    return {
      id: row.id,
      title: row.title,
      valueStreamId: row.valueStream?.id ?? null,
      valueStream: row.valueStream?.name ?? null,
      isHypothesisOnly: row.businessCaseApprovedAt === null,
      costSlices: view.costSlices,
      hypothesisBudget: alloc?.hypothesisBudget != null ? Number(alloc.hypothesisBudget) : 0,
      startKey: halfYearKey(view.costStart),
      allocations: parsePeriodMap(alloc?.allocations),
      priority: alloc?.priority ?? 0,
    };
  });

  const pool = parsePeriodMap(tenant?.budgetPoolByPeriod);

  // Axis spans the earliest Epic start to the latest need/pool period.
  const startDates = epics
    .map((e) => parseHalfYearKey(e.startKey))
    .filter((d): d is Date => d != null);
  const poolDates = Object.keys(pool)
    .map((k) => parseHalfYearKey(k))
    .filter((d): d is Date => d != null);
  const lows = [...startDates, ...poolDates];
  const from = lows.length ? lows.reduce((m, d) => (d < m ? d : m)) : halfYearStart(new Date());
  const ends = epics.map((e) => {
    const start = parseHalfYearKey(e.startKey) ?? from;
    const span = e.isHypothesisOnly ? 1 : Math.max(1, e.costSlices.length);
    return addHalfYears(start, span - 1);
  });
  const to = [...ends, ...poolDates].reduce((m, d) => (d > m ? d : m), from);

  const axis = buildHalfYearAxis(from, to);
  return { epics, periods: axis.periods, pool };
}

export interface SaveBudgetAllocationInput {
  epicId: EpicId;
  priority: number;
  hypothesisBudget: number | null;
  allocations: Record<string, number>;
}

/** Upserts an Epic's budgeting allocation (priority, hypothesis budget, per-period grants). */
export async function saveBudgetAllocation(
  ctx: RequestContext,
  input: SaveBudgetAllocationInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { epicId, priority, hypothesisBudget, allocations } = input;
  return withAuditedTransaction(mctx, async (tx) => {
    const data = {
      priority,
      hypothesisBudget,
      allocations: allocations as unknown as Prisma.InputJsonValue,
    };
    const row = await tx.budgetAllocation.upsert({
      where: { epicId },
      update: { ...data, updatedBy: mctx.actorId },
      create: {
        ...data,
        tenantId: mctx.tenantId,
        epicId,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
    });

    // Derive the Epic schedule from where the money actually lands. The rule and
    // the actuals-preserving merge live in the Epic Schedule module; with nothing
    // funded it returns null and the timeline is left untouched.
    const estimates = scheduleFromFundedWindow(allocations);
    if (estimates) {
      const epic = await tx.initiative.findFirst({
        where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC },
        select: { timeline: true },
      });
      const timeline = parseTimeline(epic?.timeline);
      await tx.initiative.update({
        where: { id: epicId },
        data: {
          updatedBy: mctx.actorId,
          timeline: withScheduleEstimates(timeline, estimates) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return ok({
      result: { id: row.id },
      audit: {
        action: "budget_allocation.saved",
        resourceType: "budget_allocation",
        resourceId: row.id,
      },
    });
  });
}

/** Saves the tenant's total budget pool per half-year. */
export async function saveBudgetPool(
  ctx: RequestContext,
  input: { byPeriod: Record<string, number> },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    await tx.tenant.update({
      where: { id: mctx.tenantId },
      data: { budgetPoolByPeriod: input.byPeriod as unknown as Prisma.InputJsonValue },
    });
    return ok({
      result: { id: mctx.tenantId },
      audit: {
        action: "budget_pool.saved",
        resourceType: "budget_pool",
        resourceId: mctx.tenantId,
      },
    });
  });
}
