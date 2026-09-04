/**
 * Run-the-Business-Positionen — die **eine** Definition der Betriebskosten.
 * Stehend, vom VS-Owner gepflegt, optional einer Solution zugerechnet und mit
 * eigener Periode (`domain/rtb-interval.ts`).
 *
 * Autorisierung in zwei Stufen: die Action gated grob, hier entscheidet
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
import { rtbIntervalOrDefault } from "@/modules/budgeting/domain/rtb-interval";
import { assertRtbManage } from "@/modules/budgeting/server/services/rtb-authz";
import { isChangeKind, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";

export interface RtbItemFilter {
  valueStreamId?: string;
  /** Genau die Positionen dieser Solution. Ohne Filter: alle, auch die ohne. */
  solutionId?: string;
  /** Genau die Positionen dieses ARTs. Ohne Filter: alle, auch die ohne. */
  artId?: string;
  /** `"run"` = Betrieb, `"art_change"` = ART-Epic-Budget. Ohne Filter: beide. */
  kind?: string;
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
      ...(filter.artId != null && { artId: filter.artId }),
      ...(filter.kind != null && { kind: filter.kind }),
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
      artId: true,
      kind: true,
    },
  });
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
}

/**
 * Ein ART-Epic-Budget braucht einen ART, und der muss zu diesem Wertstrom
 * gehören.
 *
 * Ohne ART hätte das Budget niemanden, der es verteilen darf — `loadArtPot`
 * gruppiert die Awards nach `artId`, eine Position ohne ART fiele lautlos aus
 * jeder Sicht. Und ein ART aus einem fremden Wertstrom bekäme Geld aus einem
 * Zuspruch, der ihm nicht gilt.
 *
 * `null` = in Ordnung.
 */
async function assertArtFits(
  tx: Prisma.TransactionClient,
  tenantId: string,
  valueStreamId: string,
  kind: string,
  artId: string | null,
): Promise<Result<never> | null> {
  if (!isChangeKind(kind)) return null;
  if (artId == null)
    return err({
      kind: "conflict" as const,
      reason: "Ein ART-Epic-Budget braucht den ART, für den es reserviert wird.",
    });
  const art = await tx.art.findFirst({
    where: { id: artId, tenantId, valueStreamId },
    select: { id: true },
  });
  if (!art)
    return err({
      kind: "conflict" as const,
      reason: "Dieser ART gehört nicht zu diesem Wertstrom.",
    });
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
    artId?: string | null | undefined;
    kind?: string | undefined;
  },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const denied = await assertRtbManage(ctx, tx, mctx.tenantId, input.valueStreamId, "items");
    if (denied) return denied;
    const badArt = await assertArtFits(
      tx,
      mctx.tenantId,
      input.valueStreamId,
      rtbKindOrDefault(input.kind),
      input.artId ?? null,
    );
    if (badArt) return badArt;

    const row = await tx.runTheBusinessItem.create({
      data: {
        tenantId: mctx.tenantId,
        valueStreamId: input.valueStreamId,
        name: input.name,
        plannedAmount: input.plannedAmount,
        interval: rtbIntervalOrDefault(input.interval),
        solutionId: input.solutionId ?? null,
        artId: input.artId ?? null,
        kind: rtbKindOrDefault(input.kind),
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
    artId?: string | null | undefined;
    kind?: string | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const item = await tx.runTheBusinessItem.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { valueStreamId: true, kind: true, artId: true },
    });
    if (!item)
      return err({ kind: "not_found" as const, resourceType: "RunTheBusinessItem", id: input.id });
    const denied = await assertRtbManage(ctx, tx, mctx.tenantId, item.valueStreamId, "items");
    if (denied) return denied;
    // Gegen den Zustand **nach** der Änderung prüfen: wer eine Betriebsposition
    // zum ART-Epic-Budget macht, muss dabei einen ART mitgeben.
    const badArt = await assertArtFits(
      tx,
      mctx.tenantId,
      item.valueStreamId,
      rtbKindOrDefault(input.kind ?? item.kind),
      input.artId !== undefined ? input.artId : item.artId,
    );
    if (badArt) return badArt;

    await tx.runTheBusinessItem.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.plannedAmount !== undefined && { plannedAmount: input.plannedAmount }),
        ...(input.active !== undefined && { active: input.active }),
        ...(input.interval !== undefined && { interval: rtbIntervalOrDefault(input.interval) }),
        ...(input.solutionId !== undefined && { solutionId: input.solutionId }),
        ...(input.artId !== undefined && { artId: input.artId }),
        ...(input.kind !== undefined && { kind: rtbKindOrDefault(input.kind) }),
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
    const denied = await assertRtbManage(ctx, tx, mctx.tenantId, item.valueStreamId, "items");
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
