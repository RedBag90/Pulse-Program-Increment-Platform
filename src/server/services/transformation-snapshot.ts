import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import { createPrismaClient } from "@/server/db/prisma";
import { withAuditedTransaction, type MutationContext } from "@/server/services/mutation";
import { computeStructureGap, goalKpiProgress } from "@/server/services/transformation";
import { listGoals } from "@/server/services/target-goal";

/** Actor id recorded for background (cron) captures — no human triggered them. */
const SYSTEM_ACTOR = "system" as UserId;

/**
 * Transformation snapshots — the "Reise über Zeit". Each capture records the
 * headline metrics (goal achievement, structure progress) for one tenant on one
 * day, so the cockpit can plot the trend. Idempotent per day (upsert), audited,
 * and derived purely from the current state — never hand-edited.
 */

/** A goal as far as the snapshot maths cares: its status and its KPI rows. */
export interface SnapshotGoalInput {
  status: string;
  kpis: { baseline: number | null; target: number; current: number | null }[];
}

/** The derived headline metrics of a single capture. */
export interface SnapshotMetrics {
  /** Mean goal KPI progress over active goals that carry KPIs (0..1). */
  goalAchievement: number;
  goalCount: number;
  achievedGoalCount: number;
}

/**
 * Pure aggregation of the goal-derived snapshot metrics. `goalCount` counts the
 * non-archived (active + achieved) goals; `goalAchievement` averages the KPI
 * progress over the active goals that actually carry KPIs (so goals without
 * KPIs neither help nor hurt). Mirrors the cockpit's own goal-achievement maths.
 */
export function computeSnapshotMetrics(goals: SnapshotGoalInput[]): SnapshotMetrics {
  const tracked = goals.filter((g) => g.status !== "archived");
  const withKpis = tracked.filter((g) => g.status === "active" && g.kpis.length > 0);
  const goalAchievement = withKpis.length
    ? withKpis.reduce((sum, g) => sum + goalKpiProgress(g.kpis), 0) / withKpis.length
    : 0;
  return {
    goalAchievement,
    goalCount: tracked.length,
    achievedGoalCount: tracked.filter((g) => g.status === "achieved").length,
  };
}

/** Today as a UTC-midnight `Date`, the canonical key for a `@db.Date` column. */
export function snapshotDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Captures the current transformation state for the tenant. Idempotent per day:
 * a re-run on the same `capturedOn` overwrites the row (upsert), so manual and
 * scheduled captures converge on one row per tenant per day. Audited.
 */
export async function captureTransformationSnapshot(
  ctx: MutationContext,
  now: Date = new Date(),
): Promise<Result<{ id: string }>> {
  const capturedOn = snapshotDay(now);
  const [goals, gap] = await Promise.all([
    listGoals(ctx.db, ctx.tenantId),
    computeStructureGap(ctx.db, ctx.tenantId),
  ]);
  const metrics = computeSnapshotMetrics(goals);
  const structureProgress = gap.hasTarget ? gap.overallProgress : 0;

  return withAuditedTransaction(ctx, async (tx) => {
    const row = await tx.transformationSnapshot.upsert({
      where: { tenantId_capturedOn: { tenantId: ctx.tenantId, capturedOn } },
      create: {
        tenantId: ctx.tenantId,
        capturedOn,
        goalAchievement: metrics.goalAchievement,
        structureProgress,
        goalCount: metrics.goalCount,
        achievedGoalCount: metrics.achievedGoalCount,
      },
      update: {
        goalAchievement: metrics.goalAchievement,
        structureProgress,
        goalCount: metrics.goalCount,
        achievedGoalCount: metrics.achievedGoalCount,
      },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "transformation_snapshot.captured",
        resourceType: "transformation_snapshot",
        resourceId: row.id,
      },
    });
  });
}

/**
 * Captures a snapshot for every tenant — the daily cron entry point. Uses a
 * per-tenant RLS-aware client so each capture runs in the tenant's context and
 * is attributed to the system actor. One tenant's failure does not abort the
 * rest; the run reports per-tenant counts.
 */
export async function captureAllTenantSnapshots(
  systemDb: PrismaClient,
  now: Date = new Date(),
): Promise<{ captured: number; failed: number }> {
  const tenants = await systemDb.tenant.findMany({ select: { id: true } });
  let captured = 0;
  let failed = 0;

  for (const { id } of tenants) {
    const tenantId = id as TenantId;
    const db = createPrismaClient({ userId: SYSTEM_ACTOR, tenantId });
    const ctx: MutationContext = { db, tenantId, actorId: SYSTEM_ACTOR };
    try {
      const result = await captureTransformationSnapshot(ctx, now);
      if (isErr(result)) failed += 1;
      else captured += 1;
    } catch {
      failed += 1;
    }
  }

  return { captured, failed };
}

/**
 * The most recent `limit` snapshots, returned oldest→newest so a sparkline can
 * map them left→right. Backs the cockpit trend panel.
 */
export async function listSnapshots(db: PrismaClient, tenantId: TenantId, limit = 90) {
  const rows = await db.transformationSnapshot.findMany({
    where: { tenantId },
    orderBy: { capturedOn: "desc" },
    take: limit,
  });
  return rows.reverse();
}

/**
 * Maps a series of 0..1 values to `x,y` points on a fixed-size SVG canvas — the
 * pure geometry behind the trend sparkline. `y` is inverted (0 at the bottom)
 * and the full 0..1 band is used, so the line shows absolute achievement rather
 * than a self-scaled min/max. A single point lands at the right edge.
 */
export function sparklinePoints(
  values: number[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  if (values.length === 1) {
    return [{ x: width, y: height * (1 - clamp(values[0]!)) }];
  }
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => ({ x: i * step, y: height * (1 - clamp(v)) }));
}
