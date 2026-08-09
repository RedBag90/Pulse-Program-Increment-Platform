import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";
import {
  buildBudgetPlanSnapshot,
  type ArtSnapshotInput,
  type BudgetPlanSnapshot,
  type FeatureSnapshotInput,
} from "@/domain/budget-plan-snapshot";
import { parsePeriodAmountMap } from "@/domain/budgeting";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { getBudgetingBoard } from "@/server/services/budgeting";

/**
 * Budget-Plan-Revisionen — manually-triggered, half-year-keyed snapshots of
 * the participatory-budgeting plan. Captures Epic prioritisation, per-Epic
 * allocations across all occupied half-years, the Value-Stream + ART roll-ups
 * and the Features that were assigned to PIs within the captured cycle. The
 * row is upserted on `(tenantId, cycleKey)` so re-capturing within the same
 * half-year overwrites the previous snapshot (audit trail records both).
 */

const SNAPSHOT_VERSION = 1;

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export interface CaptureBudgetPlanRevisionInput {
  /** Defaults to `new Date()`; injected by tests to pin the cycle. */
  now?: Date | undefined;
}

export async function captureBudgetPlanRevision(
  ctx: RequestContext,
  input: CaptureBudgetPlanRevisionInput = {},
): Promise<Result<{ id: string; cycleKey: string }>> {
  const mctx = toMutationContext(ctx);
  const capturedAt = input.now ?? new Date();
  const cycleKey = halfYearKey(capturedAt);

  // Load everything we need to freeze *outside* the transaction — these are
  // read-only and the snapshot is just a fold over them.
  const [board, artRows, featureRows] = await Promise.all([
    getBudgetingBoard(ctx.db, mctx.tenantId),
    loadArtSnapshotInputs(ctx.db, mctx.tenantId),
    loadFeatureSnapshotInputs(ctx.db, mctx.tenantId),
  ]);

  const snapshot = buildBudgetPlanSnapshot({
    cycleKey,
    capturedAt,
    pool: board.pool,
    epics: board.epics,
    artRows,
    features: featureRows,
  });

  const payload: Prisma.InputJsonValue = {
    version: SNAPSHOT_VERSION,
    snapshot,
  } as unknown as Prisma.InputJsonValue;

  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.budgetPlanRevision.upsert({
      where: { tenantId_cycleKey: { tenantId: mctx.tenantId, cycleKey } },
      create: {
        tenantId: mctx.tenantId,
        cycleKey,
        capturedAt,
        capturedBy: mctx.actorId,
        payload,
      },
      update: {
        capturedAt,
        capturedBy: mctx.actorId,
        payload,
      },
      select: { id: true, cycleKey: true },
    });

    return ok({
      result: { id: row.id, cycleKey: row.cycleKey },
      audit: {
        action: "budget_plan.revision.captured",
        resourceType: "budget_plan_revision",
        resourceId: row.id,
        changes: {
          cycleKey: { before: null, after: cycleKey },
          epicCount: { before: null, after: snapshot.epics.length },
          cycleBudgetSum: {
            before: null,
            after: snapshot.epics.reduce((s, e) => s + e.cycleBudget, 0),
          },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface BudgetPlanRevisionHeader {
  id: string;
  cycleKey: string;
  cycleLabel: string;
  capturedAt: Date;
  capturedBy: string;
  epicCount: number;
  cycleBudgetSum: number;
  followBudgetSum: number;
}

/**
 * Headers for every captured revision, newest first. Reads enough payload to
 * fill the overview-page summary cards without hauling the full snapshot.
 */
export async function listBudgetPlanRevisions(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetPlanRevisionHeader[]> {
  const rows = await db.budgetPlanRevision.findMany({
    where: { tenantId },
    select: { id: true, cycleKey: true, capturedAt: true, capturedBy: true, payload: true },
    orderBy: { capturedAt: "desc" },
  });
  return rows.map((r) => {
    const snapshot = readSnapshotPayload(r.payload);
    const cycleBudgetSum = snapshot?.epics.reduce((s, e) => s + e.cycleBudget, 0) ?? 0;
    const followBudgetSum = snapshot?.epics.reduce((s, e) => s + (e.total - e.cycleBudget), 0) ?? 0;
    return {
      id: r.id,
      cycleKey: r.cycleKey,
      cycleLabel: snapshot?.cycleLabel ?? r.cycleKey,
      capturedAt: r.capturedAt,
      capturedBy: r.capturedBy,
      epicCount: snapshot?.epics.length ?? 0,
      cycleBudgetSum,
      followBudgetSum,
    };
  });
}

/** A single revision with its full payload — feeds the detail page. */
export async function getBudgetPlanRevision(
  db: PrismaClient,
  tenantId: TenantId,
  id: string,
): Promise<(BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot }) | null> {
  const row = await db.budgetPlanRevision.findFirst({
    where: { id, tenantId },
    select: { id: true, cycleKey: true, capturedAt: true, capturedBy: true, payload: true },
  });
  if (!row) return null;
  const snapshot = readSnapshotPayload(row.payload);
  if (!snapshot) return null;
  const cycleBudgetSum = snapshot.epics.reduce((s, e) => s + e.cycleBudget, 0);
  const followBudgetSum = snapshot.epics.reduce((s, e) => s + (e.total - e.cycleBudget), 0);
  return {
    id: row.id,
    cycleKey: row.cycleKey,
    cycleLabel: snapshot.cycleLabel,
    capturedAt: row.capturedAt,
    capturedBy: row.capturedBy,
    epicCount: snapshot.epics.length,
    cycleBudgetSum,
    followBudgetSum,
    snapshot,
  };
}

/** Convenience: the most-recently-captured revision (any cycle), or null. */
export async function getLatestBudgetPlanRevision(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<(BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot }) | null> {
  const row = await db.budgetPlanRevision.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { capturedAt: "desc" },
  });
  if (!row) return null;
  return getBudgetPlanRevision(db, tenantId, row.id);
}

// ---------------------------------------------------------------------------
// Internal helpers (loaders + payload parser)
// ---------------------------------------------------------------------------

async function loadArtSnapshotInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<ArtSnapshotInput[]> {
  const arts = await db.art.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      budget: { select: { byPeriod: true } },
    },
    orderBy: { name: "asc" },
  });
  return arts.map((a) => ({
    artId: a.id,
    name: a.name,
    budgetByPeriod: parsePeriodAmountMap(a.budget?.byPeriod),
  }));
}

async function loadFeatureSnapshotInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<FeatureSnapshotInput[]> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      piId: { not: null },
      parentId: { not: null },
      artId: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      parentId: true,
      artId: true,
      wsjfJobSize: true,
      art: { select: { name: true } },
      pi: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
  });
  const out: FeatureSnapshotInput[] = [];
  for (const r of rows) {
    if (!r.pi || !r.artId || !r.parentId) continue; // type-narrowing
    out.push({
      featureId: r.id,
      parentEpicId: r.parentId,
      title: r.title,
      status: r.status,
      artId: r.artId,
      artName: r.art?.name ?? "—",
      wsjfJobSize: r.wsjfJobSize ?? null,
      piId: r.pi.id,
      piName: r.pi.name,
      piStartDate: r.pi.startDate,
      piEndDate: r.pi.endDate,
    });
  }
  return out;
}

/**
 * Reads the typed snapshot out of the Json payload column. Tolerant of legacy
 * rows that may have been written without the `{ version, snapshot }` envelope
 * (treat the row as the snapshot itself).
 */
function readSnapshotPayload(raw: unknown): BudgetPlanSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if ("snapshot" in obj && obj.snapshot && typeof obj.snapshot === "object") {
    return obj.snapshot as BudgetPlanSnapshot;
  }
  // Fallback: someone wrote the snapshot directly into payload.
  if ("cycleKey" in obj && "epics" in obj) {
    return obj as unknown as BudgetPlanSnapshot;
  }
  return null;
}
