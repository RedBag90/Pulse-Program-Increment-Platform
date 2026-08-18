/**
 * Participatory budgeting service — loads the budgeting board (Epics staged for
 * the next budget meeting that have an approved hypothesis or business case),
 * and persists the pool, per-Epic allocations, and scheduling. The half-year
 * maths live in the pure `@/domain/budgeting` module.
 */

import { cache } from "react";
import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId, ValueStreamId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok } from "@/modules/core/kernel/domain/errors";
import { computeAllocationScheduleUpdate } from "@/modules/budgeting/domain/allocation-schedule";
import { deriveEpicEconomics } from "@/modules/work/domain/epic-economics";
import {
  halfYearKey,
  parseHalfYearKey,
  halfYearStart,
  addHalfYears,
} from "@/modules/core/kernel/domain/calendar";
import {
  buildHalfYearAxis,
  parsePeriodAmountMap,
  rollupByValueStream,
  type BudgetEpicView,
  type HalfYearAxis,
} from "@/modules/budgeting/domain/budgeting";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";

export interface BudgetingBoardData {
  epics: BudgetEpicView[];
  periods: { key: string; label: string }[];
  /** Total budget pool per half-year key. */
  pool: Record<string, number>;
  /**
   * The forecast axis identity, so the client need not re-parse `periods[0]`
   * to recover the horizon start. `periods.length === count`.
   */
  axis: { start: Date; count: number };
}

/** A Value Stream's budget derived from its Epics' allocations, per half-year. */
export interface ValueStreamBudget {
  valueStreamId: string;
  name: string;
  /** Σ allocated to this Value Stream's Epics per half-year key. */
  byPeriod: Record<string, number>;
  /** Σ across all periods. */
  total: number;
}

export interface ValueStreamBudgetData {
  /** The participatory-budgeting forecast horizon (half-years), oldest first. */
  periods: { key: string; label: string }[];
  valueStreams: ValueStreamBudget[];
}

/** Reads a JSON map of period-key → number, discarding malformed entries. */
/**
 * The shared participatory-budgeting model: the eligible Epics, the forecast
 * half-year axis, and the tenant pool. Backs both the budgeting board and the
 * derived Value-Stream budgets, so both use the identical horizon + population.
 */
const loadBudgetingModel = cache(async function loadBudgetingModel(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<{ epics: BudgetEpicView[]; axis: HalfYearAxis; pool: Record<string, number> }> {
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
      allocations: parsePeriodAmountMap(alloc?.allocations),
      priority: alloc?.priority ?? 0,
    };
  });

  const pool = parsePeriodAmountMap(tenant?.budgetPoolByPeriod);

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
  return { epics, axis, pool };
});

/** Loads the budgeting board: eligible Epics + their need/allocation + the pool. */
export async function getBudgetingBoard(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingBoardData> {
  const { epics, axis, pool } = await loadBudgetingModel(db, tenantId);
  return { epics, periods: axis.periods, pool, axis: { start: axis.start, count: axis.count } };
}

/**
 * Value-Stream budgets derived from the participatory-budgeting allocations of
 * their Epics, per half-year across the forecast horizon. Read-only — always in
 * sync with the allocations, no separately-stored value. Reuses the per-Value-
 * Stream rollup; the unassigned ("Ohne Wertstrom") bucket is dropped.
 */
export async function getValueStreamBudgets(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<ValueStreamBudgetData> {
  const { epics, axis } = await loadBudgetingModel(db, tenantId);
  const valueStreams: ValueStreamBudget[] = rollupByValueStream(epics, axis)
    .filter((r): r is typeof r & { valueStreamId: string } => r.valueStreamId != null)
    .map((r) => ({
      valueStreamId: r.valueStreamId,
      name: r.valueStream ?? "",
      byPeriod: r.byPeriod,
      total: r.total,
    }));
  return { periods: axis.periods, valueStreams };
}

/**
 * One Value Stream's budget (+ the forecast periods), for consumers that need a
 * single VS and would otherwise pull the whole board and discard the rest.
 *
 * Scoped `.find` inside the seam, not a narrower Prisma query: the forecast axis
 * (and thus the `periods` columns) is derived tenant-wide from every staged
 * Epic's start + the pool, so scoping the query to one VS's Epics would shift
 * the horizon and change the output. The seam owns the "pick one VS" logic; the
 * output stays identical to `getValueStreamBudgets(...).valueStreams.find(...)`.
 */
export async function getValueStreamBudget(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
): Promise<{ periods: { key: string; label: string }[]; budget: ValueStreamBudget | null }> {
  const { epics, axis } = await loadBudgetingModel(db, tenantId);
  const row = rollupByValueStream(epics, axis).find((r) => r.valueStreamId === valueStreamId);
  const budget: ValueStreamBudget | null = row
    ? { valueStreamId, name: row.valueStream ?? "", byPeriod: row.byPeriod, total: row.total }
    : null;
  return { periods: axis.periods, budget };
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

    // Derive the Epic schedule from where the money actually lands — the
    // funded-window → planned-dates + timeline-estimate mirroring (incl. the
    // clear-on-empty invariant) lives in the pure domain seam.
    const epic = await tx.initiative.findFirst({
      where: { id: epicId, tenantId: mctx.tenantId, level: InitiativeLevel.EPIC },
      select: { timeline: true },
    });
    const schedule = computeAllocationScheduleUpdate(allocations, epic?.timeline);
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        updatedBy: mctx.actorId,
        plannedStartAt: schedule.plannedStartAt,
        plannedEndAt: schedule.plannedEndAt,
        ...(schedule.timeline
          ? { timeline: schedule.timeline as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });

    // Budgeting schreibt nicht mehr in die Reifegrad-Spalten von Work. Die
    // Budget-Summe ist ein L3-Readiness-Kriterium, das beim Lesen aus der
    // Allokation abgeleitet wird — eine Cross-Modul-Schreibkopplung weniger
    // (ADR-0015), ohne sie durch ein Event ersetzen zu müssen.

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
