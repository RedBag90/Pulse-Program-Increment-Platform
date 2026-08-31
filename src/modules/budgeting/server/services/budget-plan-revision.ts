import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok } from "@/modules/core/kernel/domain/errors";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import {
  buildBudgetPlanSnapshot,
  summarizeSnapshot,
  type ArtSnapshotInput,
  type BudgetPlanSnapshot,
  type FeatureSnapshotInput,
} from "@/modules/budgeting/domain/budget-plan-snapshot";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import {
  buildPbRoundSnapshot,
  type PbRoundSnapshot,
} from "@/modules/budgeting/domain/pb-round-snapshot";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { getBudgetingBoard } from "@/modules/budgeting/server/services/budgeting";
import { getRoundForCycle } from "@/modules/budgeting/server/services/round-service";
import { loadZonesModel } from "@/modules/budgeting/server/views/zones-view";
import { listTenantUserLabels } from "@/server/services/tenant-users";

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
  /**
   * Der einzufrierende Zyklus. Kommt von der Kachel, aus der heraus erfasst
   * wird — ohne ihn träfe der Snapshot das *heutige* Halbjahr und damit
   * womöglich eine andere Kachel als die, die man vor sich hat.
   */
  cycleKey?: string | undefined;
}

export async function captureBudgetPlanRevision(
  ctx: RequestContext,
  input: CaptureBudgetPlanRevisionInput = {},
): Promise<Result<{ id: string; cycleKey: string }>> {
  const mctx = toMutationContext(ctx);
  const capturedAt = input.now ?? new Date();
  const cycleKey = input.cycleKey ?? halfYearKey(capturedAt);

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

  // Ein Protokoll (F-C3): die PB-Runde desselben Cycles wird — wenn vorhanden —
  // als zweite Schicht in dieselbe Revision gefaltet.
  const round = await loadPbRoundSnapshot(ctx.db, mctx.tenantId, cycleKey);

  const payload: Prisma.InputJsonValue = {
    version: SNAPSHOT_VERSION,
    snapshot,
    ...(round ? { round } : {}),
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
          cycleBudgetSum: { before: null, after: snapshot.cycleBudgetSum },
        },
      },
    });
  });
}

/**
 * Lädt die PB-Runde des Cycles + Zonen/Entscheidungen/Report-outs und faltet sie
 * in den Runden-Snapshot. `null`, wenn es für den Cycle keine Runde gibt.
 */
async function loadPbRoundSnapshot(
  db: PrismaClient,
  tenantId: TenantId,
  cycleKey: string,
): Promise<PbRoundSnapshot | null> {
  const round = await getRoundForCycle(db, tenantId, cycleKey);
  if (!round) return null;

  const [zones, decisions, reportOuts, userLabels] = await Promise.all([
    loadZonesModel(db, tenantId, round.id),
    db.budgetDecision.findMany({
      where: { roundId: round.id },
      select: { epicId: true, outcome: true },
    }),
    db.groupReportOut.findMany({
      where: { group: { roundId: round.id } },
      select: {
        groupId: true,
        costliestYesEpicId: true,
        clearestNoEpicId: true,
        biggestDisputeEpicId: true,
        costliestYesReason: true,
        clearestNoReason: true,
        disputeReason: true,
      },
    }),
    listTenantUserLabels(db, tenantId),
  ]);

  const titleByEpic = new Map((zones?.epics ?? []).map((e) => [e.epicId, e.title]));
  const reportByGroup = new Map(reportOuts.map((r) => [r.groupId, r]));
  const labelOf = (id: string | null) => (id ? (userLabels[id] ?? id) : null);
  const epicTitle = (id: string | null) => (id ? (titleByEpic.get(id) ?? null) : null);

  const groups = round.groups.map((g) => {
    const r = reportByGroup.get(g.id);
    return {
      name: g.name,
      spokesperson: labelOf(g.spokespersonId),
      reportOut: r
        ? {
            costliestYes: epicTitle(r.costliestYesEpicId),
            costliestYesReason: r.costliestYesReason,
            clearestNo: epicTitle(r.clearestNoEpicId),
            clearestNoReason: r.clearestNoReason,
            biggestDispute: epicTitle(r.biggestDisputeEpicId),
            disputeReason: r.disputeReason,
          }
        : null,
    };
  });

  return buildPbRoundSnapshot({
    cycleKey,
    status: round.status,
    poolTotal: Number(round.poolTotal),
    reserve: round.reserveAmount != null ? Number(round.reserveAmount) : null,
    zoneEpics: (zones?.epics ?? []).map((e) => ({
      epicId: e.epicId,
      title: e.title,
      cost: e.cost,
      zone: e.zone,
      yes: e.yes,
      total: e.total,
    })),
    decisions,
    groups,
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
  return rows.map(toRevisionHeader);
}

/** Rohzeile → Header + Snapshot. Die eine Projektion für alle drei Lesewege. */
function toRevisionHeader(row: {
  id: string;
  cycleKey: string;
  capturedAt: Date;
  capturedBy: string;
  payload: unknown;
}): BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot } {
  const snapshot = requireSnapshot(row.payload, row.id);
  const { cycleBudgetSum, followBudgetSum } = summarizeSnapshot(snapshot);
  return {
    id: row.id,
    cycleKey: row.cycleKey,
    cycleLabel: snapshot.cycleLabel ?? row.cycleKey,
    capturedAt: row.capturedAt,
    capturedBy: row.capturedBy,
    epicCount: snapshot.epics.length,
    cycleBudgetSum,
    followBudgetSum,
    snapshot,
  };
}

/**
 * Liest die optionale PB-Runden-Schicht aus der `payload`. `null`, wenn die
 * Revision vor der Vereinheitlichung erfasst wurde oder es keine Runde gab.
 */
function parsePbRound(raw: unknown): PbRoundSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const round = (raw as Record<string, unknown>).round;
  if (round == null || typeof round !== "object") return null;
  if (!Array.isArray((round as { epics?: unknown }).epics)) return null;
  return round as PbRoundSnapshot;
}

/** A single revision with its full payload — feeds the detail page. */
export async function getBudgetPlanRevision(
  db: PrismaClient,
  tenantId: TenantId,
  id: string,
): Promise<
  | (BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot; round: PbRoundSnapshot | null })
  | null
> {
  const row = await db.budgetPlanRevision.findFirst({
    where: { id, tenantId },
    select: { id: true, cycleKey: true, capturedAt: true, capturedBy: true, payload: true },
  });
  return row ? { ...toRevisionHeader(row), round: parsePbRound(row.payload) } : null;
}

/**
 * Convenience: the most-recently-captured revision (any cycle), or null. Eine
 * Query — vorher holte diese Funktion erst die Id und dann in einem zweiten
 * Roundtrip dieselbe Zeile noch einmal.
 */
export async function getLatestBudgetPlanRevision(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<(BudgetPlanRevisionHeader & { snapshot: BudgetPlanSnapshot }) | null> {
  const row = await db.budgetPlanRevision.findFirst({
    where: { tenantId },
    select: { id: true, cycleKey: true, capturedAt: true, capturedBy: true, payload: true },
    orderBy: { capturedAt: "desc" },
  });
  return row ? toRevisionHeader(row) : null;
}

/** Nur Zyklus + Id je Revision — OHNE den Payload zu lesen. */
export interface BudgetPlanRevisionCycle {
  id: string;
  cycleKey: string;
  cycleLabel: string;
  capturedAt: Date;
}

/**
 * Die Zyklus-Navigation der Detailseite, ohne einen einzigen Snapshot zu
 * deserialisieren: das Label folgt aus `cycleKey`, alles andere braucht die
 * Navigation nicht. Vorher zog die Detailseite dafuer `listBudgetPlanRevisions`
 * und parste damit JEDEN Payload — den der angezeigten Revision ein zweites Mal.
 */
export async function listBudgetPlanRevisionCycles(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<BudgetPlanRevisionCycle[]> {
  const rows = await db.budgetPlanRevision.findMany({
    where: { tenantId },
    select: { id: true, cycleKey: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    cycleKey: r.cycleKey,
    cycleLabel: halfYearLabel(r.cycleKey),
    capturedAt: r.capturedAt,
  }));
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

/** Parsed outcome of the `payload` Json column — success or an explicit reason. */
type SnapshotEnvelopeResult =
  | { ok: true; snapshot: BudgetPlanSnapshot }
  | { ok: false; reason: string };

/** Structural check for a bare (un-enveloped) snapshot object. */
function isBareSnapshot(v: unknown): v is BudgetPlanSnapshot {
  return (
    v != null &&
    typeof v === "object" &&
    "cycleKey" in v &&
    "epics" in v &&
    Array.isArray((v as { epics: unknown }).epics)
  );
}

/**
 * The single owner of snapshot version dispatch for the `payload` column:
 *  - `version === SNAPSHOT_VERSION` → unwrap the `{ version, snapshot }` envelope;
 *  - a recognizable legacy bare snapshot (written before the envelope existed)
 *    → accept it as-is;
 *  - anything else → an EXPLICIT typed failure, never a silent `null` that would
 *    render zeros over a malformed capture.
 */
function parseSnapshotEnvelope(raw: unknown): SnapshotEnvelopeResult {
  if (raw == null || typeof raw !== "object") {
    return { ok: false, reason: "payload is not an object" };
  }
  const obj = raw as Record<string, unknown>;

  if ("version" in obj) {
    if (obj.version !== SNAPSHOT_VERSION) {
      return { ok: false, reason: `unsupported snapshot version ${String(obj.version)}` };
    }
    if (!isBareSnapshot(obj.snapshot)) {
      return { ok: false, reason: `version ${SNAPSHOT_VERSION} envelope has no valid snapshot` };
    }
    return { ok: true, snapshot: obj.snapshot };
  }

  // Legacy: the snapshot was written straight into `payload`, pre-envelope.
  if (isBareSnapshot(obj)) return { ok: true, snapshot: obj };

  return { ok: false, reason: "unrecognized payload (no version, not a bare snapshot)" };
}

/** Unwraps the envelope or throws — read sites must not degrade to zeros. */
function requireSnapshot(raw: unknown, revisionId: string): BudgetPlanSnapshot {
  const res = parseSnapshotEnvelope(raw);
  if (!res.ok) {
    throw new Error(`BudgetPlanRevision ${revisionId}: malformed snapshot payload — ${res.reason}`);
  }
  return res.snapshot;
}
