import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, TimelineId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import {
  standardPiSchedule,
  selectFreeStandardPis,
  type PiStandardSpec,
} from "@/domain/pi-standard";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { findOr404 } from "@/server/services/tenant-scope";
import { createPi } from "@/server/services/pi";

export interface CreatePiStandardInput {
  name: string;
  anchorMonth: number;
  anchorDay: number;
  cadenceWeeks: number;
  piCount: number;
}

export interface ApplyPiStandardResult {
  /** Names of the standard PIs that were created (period was free). */
  added: string[];
  /** Names skipped because their period overlapped an existing PI. */
  skipped: string[];
}

/** Named PI calendars for the tenant, newest first — backs the dropdowns. */
export async function listPiStandards(db: PrismaClient, tenantId: TenantId) {
  return db.piStandard.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      anchorMonth: true,
      anchorDay: true,
      cadenceWeeks: true,
      piCount: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPiStandard(
  ctx: RequestContext,
  input: CreatePiStandardInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const standard = await tx.piStandard.create({
      data: {
        tenantId: mctx.tenantId,
        name: input.name,
        anchorMonth: input.anchorMonth,
        anchorDay: input.anchorDay,
        cadenceWeeks: input.cadenceWeeks,
        piCount: input.piCount,
        createdBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: standard.id },
      audit: {
        action: "pi_standard.created",
        resourceType: "pi_standard",
        resourceId: standard.id,
      },
    });
  });
}

export async function deletePiStandard(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const found = await findOr404(tx.piStandard, {
      id: input.id,
      tenantId: mctx.tenantId,
      resourceType: "PiStandard",
    });
    if (isErr(found)) return found;

    await tx.piStandard.delete({ where: { id: input.id } });

    return ok({
      result: undefined,
      audit: { action: "pi_standard.deleted", resourceType: "pi_standard", resourceId: input.id },
    });
  });
}

/**
 * Provisions a Timeline's `year` with the PIs of a named standard. Only those
 * standard PIs whose date range is free of existing PIs on the Timeline are
 * created (overlap = inclusive), so this composes with manual PIs and
 * re-applying is idempotent. Each PI is its own audited transaction via
 * `createPi`. The Timeline's cadence is aligned to the standard.
 */
export async function applyPiStandard(
  ctx: RequestContext,
  input: { timelineId: TimelineId; standardId: string; year: number },
): Promise<Result<ApplyPiStandardResult>> {
  const tenantId = ctx.principal.tenantId;

  const standardFound = await findOr404(ctx.db.piStandard, {
    id: input.standardId,
    tenantId,
    resourceType: "PiStandard",
  });
  if (isErr(standardFound)) return standardFound;
  const standard = standardFound.value;

  const timelineFound = await findOr404(ctx.db.timeline, {
    id: input.timelineId,
    tenantId,
    resourceType: "Timeline",
  });
  if (isErr(timelineFound)) return timelineFound;

  const spec: PiStandardSpec = {
    anchorMonth: standard.anchorMonth,
    anchorDay: standard.anchorDay,
    cadenceWeeks: standard.cadenceWeeks,
    piCount: standard.piCount,
  };
  const schedule = standardPiSchedule(spec, input.year);

  const existing = await ctx.db.programIncrement.findMany({
    where: { tenantId, timelineId: input.timelineId },
    select: { startDate: true, endDate: true },
  });
  const free = selectFreeStandardPis(schedule, existing);

  const added: string[] = [];
  for (const pi of free) {
    const created = await createPi(ctx, {
      timelineId: input.timelineId,
      name: pi.name,
      startDate: pi.startDate,
      endDate: pi.endDate,
    });
    if (isErr(created)) return created;
    added.push(pi.name);
  }

  const skipped = schedule.filter((p) => !added.includes(p.name)).map((p) => p.name);
  return ok({ added, skipped });
}
