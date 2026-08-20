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
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";
import { deriveEpicEconomics } from "@/modules/work/domain/epic-economics";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import {
  parsePeriodAmountMap,
  rollupByValueStream,
  type BudgetEpicView,
  type HalfYearAxis,
} from "@/modules/budgeting/domain/budgeting";
import { rollingWindow } from "@/modules/budgeting/domain/period-window";
import { resolveActiveCycle, resolveWindowSize } from "@/modules/budgeting/domain/budget-cycle";
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
  /** Editierbare Halbjahre (Rolling-Window ab Anker); Rest ist read-only. */
  editableKeys: string[];
  /** Der aktive Zyklus (Anker) als Halbjahres-Key. */
  activeCycleKey: string;
  /** Fenstergröße in Halbjahren. */
  windowSize: number;
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
): Promise<{
  epics: BudgetEpicView[];
  axis: HalfYearAxis;
  pool: Record<string, number>;
  /** Editierbare Halbjahre (das Rolling-Window ab Anker). */
  editableKeys: string[];
  /** Der aktive Zyklus (Anker) als Halbjahres-Key. */
  activeCycle: string;
  windowSize: number;
}> {
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
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { budgetPoolByPeriod: true, activeBudgetCycle: true, budgetWindowSize: true },
    }),
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

  // Rolling-Window: der Board-Horizont sind die `windowSize` Halbjahre ab dem
  // Anker (editierbar), plus alle Perioden mit Daten (Topf/Allokation) als
  // read-only Kontext. Ersetzt die frühere datenabgeleitete `forecastAxis`.
  const activeCycle = resolveActiveCycle(
    { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
    new Date(),
  );
  const windowSize = resolveWindowSize({ budgetWindowSize: tenant?.budgetWindowSize ?? null });
  const dataKeys = [
    ...new Set([...Object.keys(pool), ...epics.flatMap((e) => Object.keys(e.allocations))]),
  ];
  const win = rollingWindow(activeCycle, windowSize, dataKeys);

  return { epics, axis: win.axis, pool, editableKeys: win.windowKeys, activeCycle, windowSize };
});

/** Ein Epic, das für die Runde in Frage kommt, aber noch nicht vorgemerkt ist. */
export interface BudgetingCandidate {
  id: string;
  title: string;
  valueStream: string | null;
  isHypothesisOnly: boolean;
}

/**
 * Die Kandidatenmenge fürs Inline-Vormerken: freigegebene Epics (Hypothese oder
 * Business Case), die **noch nicht** `stagedForBudgeting` sind — das Readiness-Gate
 * aus {@link loadBudgetingModel}, invertiert auf „noch nicht vorgemerkt".
 */
export async function listBudgetingCandidates(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingCandidate[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      stagedForBudgeting: false,
      OR: [{ hypothesisApprovedAt: { not: null } }, { businessCaseApprovedAt: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      businessCaseApprovedAt: true,
      valueStream: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    valueStream: r.valueStream?.name ?? null,
    isHypothesisOnly: r.businessCaseApprovedAt === null,
  }));
}

/** Loads the budgeting board: eligible Epics + their need/allocation + the pool. */
export async function getBudgetingBoard(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetingBoardData> {
  const { epics, axis, pool, editableKeys, activeCycle, windowSize } = await loadBudgetingModel(
    db,
    tenantId,
  );
  return {
    epics,
    periods: axis.periods,
    pool,
    axis: { start: axis.start, count: axis.count },
    editableKeys,
    activeCycleKey: activeCycle,
    windowSize,
  };
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

/**
 * Nur die Σ-Budgets je Wertstrom, als `valueStreamId → total`. Genau die Form,
 * die die Struktur-, Timeline- und Reporting-Sichten brauchen — vorher baute
 * jede von ihnen diese Map selbst aus `getValueStreamBudgets(...).valueStreams`
 * (dreimal dieselbe Zeile). Der Port bleibt damit schmal: die Aufrufer sehen
 * keine Perioden-Struktur, die sie ohnehin verwerfen.
 */
export async function getValueStreamBudgetTotals(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Record<string, number>> {
  const { valueStreams } = await getValueStreamBudgets(db, tenantId);
  return Object.fromEntries(valueStreams.map((b) => [b.valueStreamId, b.total]));
}

export interface SaveBudgetAllocationInput {
  epicId: EpicId;
  priority: number;
  hypothesisBudget: number | null;
  allocations: Record<string, number>;
}

/**
 * Upserts an Epic's budgeting allocation (priority, hypothesis budget, per-period grants).
 *
 * Autorisierung nach ADR-0002 gegen die GELADENE Epic-Zeile: `loadAuthorizedEpic`
 * (Work — Abwärts-Import, erlaubt) holt das Epic tenant-scoped und prüft
 * `budget.manage` gegen dessen echten Wertstrom. Vorher upsertete der Service
 * blind auf `epicId`; die Action deklarierte nur `{ tenantId }`, wodurch jeder
 * `value_stream`-Scope vakuant erfüllt war und eine fremd-tenant-eigene `epicId`
 * nicht auffiel (Befund F-04).
 */
export async function saveBudgetAllocation(
  ctx: RequestContext,
  input: SaveBudgetAllocationInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { epicId, priority, hypothesisBudget, allocations } = input;
  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: epicId,
      action: "budget.manage",
      select: { id: true },
    });
    if (!epic.ok) return epic;

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

    // Budgeting schreibt NICHT mehr in Work's Reifegrad-Spalten: das geplante
    // Zeitfenster (plannedStartAt/plannedEndAt) und die Timeline-Estimates folgen
    // jetzt allein dem Reifegrad-Plan des Owners (`saveTimeline` → L4.1/L4.2).
    // Die Budget-Summe bleibt ein L3-Readiness-Kriterium, das beim Lesen aus der
    // Allokation abgeleitet wird — eine Cross-Modul-Schreibkopplung weniger (ADR-0015).

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
