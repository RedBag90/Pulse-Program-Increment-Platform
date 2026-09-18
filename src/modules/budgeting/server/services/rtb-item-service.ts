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
import { rtbIntervalOrDefault, sumRtbCycle } from "@/modules/budgeting/domain/rtb-interval";
import { assertRtbManage } from "@/modules/budgeting/server/services/rtb-authz";
import { isChangeKind, rtbKindOrDefault } from "@/modules/budgeting/domain/rtb-kind";
import { readRtbItems } from "@/modules/budgeting/server/services/budget-reads";

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
  // Über den geteilten Lader (REQ-5): dieselbe Tabelle lesen auf einer
  // Wertstromseite drei Wege — diese Liste, der Zuspruch und die
  // Finanzierungskette —, jeder mit einem anderen `where`. Der Schnitt ist
  // billig, die Rundreise nicht.
  const rows = await readRtbItems(db, tenantId);
  return rows.filter(
    (r) =>
      (filter.valueStreamId == null || r.valueStreamId === filter.valueStreamId) &&
      (filter.solutionId == null || r.solutionId === filter.solutionId) &&
      (filter.artId == null || r.artId === filter.artId) &&
      (filter.kind == null || r.kind === filter.kind),
  );
}

/**
 * Ein ART-Epic-Budget braucht einen ART, und der muss zu diesem Wertstrom
 * gehören.
 *
 * Ohne ART hätte das Budget niemanden, der es verteilen darf — `loadArtEpicBudget`
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

/**
 * Betriebskosten je Solution als **Ask einer Halbjahres-Kachel** — dieselbe
 * Periode, auf der auch die Epic-Allokationen stehen.
 *
 * Der Horizont-Trichter der Portfolio-Übersicht braucht diese Zahl, darf das
 * Budgeting-Modul aber nicht importieren (ADR-0013: `Work ← Budgeting`, nicht
 * umgekehrt). Deshalb liegt die Rechnung hier und wird als Port hereingereicht —
 * dasselbe Muster wie `BudgetingDataPort` für die Kacheln.
 *
 * Nur `kind: "run"` zählt: `art_change` ist ART-Epic-Budget, also Grow-Arbeit,
 * und würde als Betrieb ausgewiesen die Aussage des Bildes verfälschen.
 * Umgerechnet wird ausschließlich über `sumRtbCycle` — die Positionen tragen
 * eine Periode, und rohe Beträge zu summieren mischt Halbjahre mit Jahren.
 */
export async function solutionCycleRunCosts(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<Record<string, number>> {
  return (await cycleRunCosts(db, tenantId)).bySolution;
}

export interface CycleRunCosts {
  /** Betrieb je Solution-Id. */
  bySolution: Record<string, number>;
  /**
   * Betrieb, der **keiner** Solution zugerechnet ist — wertstromübergreifend
   * (geteilte Plattform, Programm-Office). Er fällt im Zyklus an, gehört aber
   * keinem Produkt; der Horizont-Trichter zeigt ihn deshalb im Streifen, statt
   * ihn einem Band zuzuschlagen, das ihn nicht trägt.
   */
  unassigned: { valueStreamId: string; valueStreamName: string | null; amount: number }[];
}

/** Betrieb des Halbjahres, getrennt nach zugerechnet und wertstromübergreifend. */
export async function cycleRunCosts(db: PrismaClient, tenantId: TenantId): Promise<CycleRunCosts> {
  const rows = await db.runTheBusinessItem.findMany({
    where: { tenantId, kind: "run" },
    select: {
      solutionId: true,
      valueStreamId: true,
      plannedAmount: true,
      interval: true,
      active: true,
      valueStream: { select: { name: true } },
    },
  });

  type Item = { plannedAmount: number; interval: string; active: boolean };
  const bySolution = new Map<string, Item[]>();
  const byValueStream = new Map<string, { name: string | null; items: Item[] }>();
  for (const r of rows) {
    const item: Item = {
      plannedAmount: Number(r.plannedAmount),
      interval: r.interval,
      active: r.active,
    };
    if (r.solutionId != null) {
      bySolution.set(r.solutionId, [...(bySolution.get(r.solutionId) ?? []), item]);
      continue;
    }
    const vs = byValueStream.get(r.valueStreamId) ?? {
      name: r.valueStream?.name ?? null,
      items: [],
    };
    vs.items.push(item);
    byValueStream.set(r.valueStreamId, vs);
  }

  return {
    bySolution: Object.fromEntries([...bySolution].map(([id, items]) => [id, sumRtbCycle(items)])),
    unassigned: [...byValueStream]
      .map(([valueStreamId, v]) => ({
        valueStreamId,
        valueStreamName: v.name,
        amount: sumRtbCycle(v.items),
      }))
      .filter((v) => v.amount > 0),
  };
}

/**
 * Zuteilungen aus dem **ART-Topf** je Epic in einem Zyklus.
 *
 * Der zweite Geldweg neben `BudgetAllocation`: ART-Epics werden aus dem Rahmen
 * ihres ARTs finanziert. Wer nur den ersten liest, sieht ihr Geld nicht — in
 * Pulse Demo Corp sind das 292 T€ auf vier Epics.
 */
export async function artEpicCycleAllocations(
  db: PrismaClient,
  tenantId: TenantId,
  cycleKey: string | null,
): Promise<Record<string, number>> {
  if (cycleKey == null) return {};
  const rows = await db.artEpicAllocation.findMany({
    where: { tenantId, cycleKey },
    select: { epicId: true, amount: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.epicId] = (out[r.epicId] ?? 0) + Number(r.amount);
  return out;
}
