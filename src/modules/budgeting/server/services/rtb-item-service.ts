/**
 * Run-the-Business-Positionen — die **eine** Definition der Betriebskosten.
 * Stehend, vom VS-Owner gepflegt, optional einer Solution zugerechnet und mit
 * eigener Periode (`domain/rtb-interval.ts`).
 *
 * Autorisierung wie `saveArtBudget`: die Action gated grob, hier entscheidet
 * `authorizeResource` VS-scoped — plus der Finance-Partei-Bypass
 * (`ValueStream.financeApproverId`). Sie hängt bewusst weiter am **Wertstrom**,
 * auch wenn eine Position einer Solution zugerechnet ist: das Budget dieser
 * Kosten wird im Wertstrom verantwortet.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { authorizeResource } from "@/server/auth/authorize";
import { rtbIntervalOrDefault } from "@/modules/budgeting/domain/rtb-interval";

export interface RtbItemFilter {
  valueStreamId?: string;
  /** Genau die Positionen dieser Solution. Ohne Filter: alle, auch die ohne. */
  solutionId?: string;
}

/**
 * Die Positionen eines Tenants, wahlweise auf einen Wertstrom oder eine
 * Solution eingeengt. Ohne Filter alle — das braucht die Solutions-Liste, die
 * ihre Run-Spalte in einem Rutsch aggregiert.
 */
export async function listRtbItems(
  db: PrismaClient,
  tenantId: TenantId,
  filter: RtbItemFilter = {},
) {
  const rows = await db.runTheBusinessItem.findMany({
    where: {
      tenantId,
      ...(filter.valueStreamId != null && { valueStreamId: filter.valueStreamId }),
      ...(filter.solutionId != null && { solutionId: filter.solutionId }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      plannedAmount: true,
      active: true,
      interval: true,
      solutionId: true,
      valueStreamId: true,
    },
  });
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
}

export type RtbItemRow = Awaited<ReturnType<typeof listRtbItems>>[number];

/** VS-scoped Autorisierung + Finance-Bypass. `null` = erlaubt. */
async function assertManage(
  ctx: RequestContext,
  tx: Prisma.TransactionClient,
  tenantId: string,
  valueStreamId: string,
): Promise<Result<never> | null> {
  const vs = await tx.valueStream.findFirst({
    where: { id: valueStreamId, tenantId },
    select: { financeApproverId: true },
  });
  if (!vs)
    return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
  if (vs.financeApproverId === ctx.principal.id) return null;
  const decision = authorizeResource(ctx.principal, "rtb_item.manage", { tenantId, valueStreamId });
  if (!decision.ok) {
    return err({
      kind: "forbidden" as const,
      reason:
        "Nur der Wertstrom-Owner/Finance-Partei (oder Portfolio-Manager/Admin) darf Run-the-Business-Positionen pflegen.",
    });
  }
  return null;
}

export async function createRtbItem(
  ctx: RequestContext,
  input: {
    valueStreamId: string;
    name: string;
    plannedAmount: number;
    interval?: string | undefined;
    solutionId?: string | null | undefined;
  },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const denied = await assertManage(ctx, tx, mctx.tenantId, input.valueStreamId);
    if (denied) return denied;

    const row = await tx.runTheBusinessItem.create({
      data: {
        tenantId: mctx.tenantId,
        valueStreamId: input.valueStreamId,
        name: input.name,
        plannedAmount: input.plannedAmount,
        interval: rtbIntervalOrDefault(input.interval),
        solutionId: input.solutionId ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
      select: { id: true },
    });
    return ok({
      result: { id: row.id },
      audit: {
        action: "rtb_item.saved" as const,
        resourceType: "run_the_business_item" as const,
        resourceId: row.id,
        changes: { name: { before: null, after: input.name } },
      },
    });
  });
}

export async function updateRtbItem(
  ctx: RequestContext,
  input: {
    id: string;
    name?: string | undefined;
    plannedAmount?: number | undefined;
    active?: boolean | undefined;
    interval?: string | undefined;
    solutionId?: string | null | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const item = await tx.runTheBusinessItem.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!item)
      return err({ kind: "not_found" as const, resourceType: "RunTheBusinessItem", id: input.id });
    const denied = await assertManage(ctx, tx, mctx.tenantId, item.valueStreamId);
    if (denied) return denied;

    await tx.runTheBusinessItem.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.plannedAmount !== undefined && { plannedAmount: input.plannedAmount }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.interval !== undefined && { interval: rtbIntervalOrDefault(input.interval) }),
        ...(input.solutionId !== undefined && { solutionId: input.solutionId }),
        updatedBy: mctx.actorId,
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "rtb_item.saved" as const,
        resourceType: "run_the_business_item" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}

export async function deleteRtbItem(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const item = await tx.runTheBusinessItem.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!item)
      return err({ kind: "not_found" as const, resourceType: "RunTheBusinessItem", id: input.id });
    const denied = await assertManage(ctx, tx, mctx.tenantId, item.valueStreamId);
    if (denied) return denied;

    await tx.runTheBusinessItem.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "rtb_item.removed" as const,
        resourceType: "run_the_business_item" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}
