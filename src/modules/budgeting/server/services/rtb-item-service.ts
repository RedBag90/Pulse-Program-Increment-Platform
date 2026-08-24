/**
 * Run-the-Business-Positionen eines Value Streams (stehend, vom VS-Owner
 * gepflegt). Autorisierung wie `saveArtBudget`: die Action gated grob, hier
 * entscheidet `authorizeResource` VS-scoped — plus der Finance-Partei-Bypass
 * (`ValueStream.financeApproverId`).
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { authorizeResource } from "@/server/auth/authorize";

export async function listRtbItems(db: PrismaClient, tenantId: TenantId, valueStreamId: string) {
  const rows = await db.runTheBusinessItem.findMany({
    where: { tenantId, valueStreamId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, plannedAmount: true, active: true },
  });
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
}

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
  if (!vs) return err({ kind: "not_found" as const, resourceType: "ValueStream", id: valueStreamId });
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
  input: { valueStreamId: string; name: string; plannedAmount: number },
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
  input: { id: string; name?: string | undefined; plannedAmount?: number | undefined; active?: boolean | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const item = await tx.runTheBusinessItem.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!item) return err({ kind: "not_found" as const, resourceType: "RunTheBusinessItem", id: input.id });
    const denied = await assertManage(ctx, tx, mctx.tenantId, item.valueStreamId);
    if (denied) return denied;

    await tx.runTheBusinessItem.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.plannedAmount !== undefined && { plannedAmount: input.plannedAmount }),
        ...(input.active !== undefined && { active: input.active }),
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

export async function deleteRtbItem(ctx: RequestContext, input: { id: string }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const item = await tx.runTheBusinessItem.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!item) return err({ kind: "not_found" as const, resourceType: "RunTheBusinessItem", id: input.id });
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
