/**
 * Die **Aufteilung** des Wertstrom-Zuspruchs auf seine Positionen.
 *
 * Seit die PB-Liste je Wertstrom eine Zeile trägt, entscheidet die Runde nur die
 * Summe. Hier entscheidet der Wertstrom, wie viel davon der Betrieb bekommt und
 * wie viel die ART-Epic-Budgets seiner ARTs — und damit, wie groß der Topf
 * jedes ARTs für dieses Halbjahr ist.
 *
 * Rechte und Zeitfenster sind dieselben wie beim Verteilen des Rahmens: wer die
 * Positionen pflegen darf, teilt auch den Zuspruch auf, und vergangene
 * Halbjahre bleiben unbeweglich.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import { potWindowClosedReason } from "@/modules/budgeting/domain/art-pot-window";
import { proportionalAwards, awardSplitDeniedReason } from "@/modules/budgeting/domain/rtb-award";
import { assertRtbManage } from "@/modules/budgeting/server/services/rtb-authz";

export interface RtbAwardRow {
  rtbItemId: string;
  name: string;
  kind: string;
  artId: string | null;
  /** Richtwert dieser Position im Halbjahr. */
  ask: number;
  /** Zugeteilt — oder die anteilige Vorbelegung, solange nichts gesetzt ist. */
  amount: number;
}

export interface RtbAwardView {
  cycleKey: string;
  /** Was die Runde dem Wertstrom zugesprochen hat; `null` = noch keine geschlossene Kachel. */
  awarded: number | null;
  /** Σ der Richtwerte — was der Wertstrom beantragt hat. */
  requested: number;
  rows: RtbAwardRow[];
  /** Ist bereits eine Aufteilung gespeichert, oder ist das die Vorbelegung? */
  saved: boolean;
  /** Warum gerade nicht aufgeteilt werden darf; `null` = offen. */
  closedReason: string | null;
}

/**
 * Der Zuspruch eines Wertstroms für ein Halbjahr, samt Aufteilung.
 *
 * Solange **nichts** gespeichert ist, steht die anteilige Vorbelegung in den
 * Zeilen — wie der Median die Endbeträge vorbelegt, ohne sie zu entscheiden.
 *
 * Sobald einmal aufgeteilt wurde, ist die Vorbelegung vorbei: eine Position,
 * die danach dazukommt, steht auf **0 €**, bis jemand ihr etwas zuspricht. Der
 * Zuspruch ist eine Entscheidung des Wertstroms, und eine neue Zeile ist noch
 * nicht entschieden. Vorher erbte sie einen Anteil aus der Vorbelegung — mit
 * zwei Folgen: die Fläche behauptete einen Zuspruch, den niemand erteilt hatte,
 * und zusammen mit den gespeicherten Zeilen überschritt die angezeigte Summe
 * den Zuspruch des Wertstroms.
 */
export async function loadRtbAwards(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  cycleKey: string,
  now: Date = new Date(),
): Promise<RtbAwardView> {
  const [items, candidate, awards] = await Promise.all([
    db.runTheBusinessItem.findMany({
      where: { tenantId, valueStreamId, active: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        artId: true,
        plannedAmount: true,
        interval: true,
      },
    }),
    db.budgetCandidate.findFirst({
      where: {
        tenantId,
        kind: "rtb",
        valueStreamId,
        finalAmount: { not: null },
        round: { cycleKey },
      },
      select: { finalAmount: true },
    }),
    // Nur die Awards dieses Wertstroms: vorher las die Abfrage alle Awards des
    // Mandanten je Zyklus und warf beim Mappen fast alles wieder weg.
    db.rtbItemAward.findMany({
      where: { tenantId, cycleKey, rtbItem: { valueStreamId } },
      select: { rtbItemId: true, amount: true },
    }),
  ]);

  const asks = items.map((i) => ({
    id: i.id,
    ask: rtbCycleAmount(Number(i.plannedAmount), i.interval),
  }));
  const requested = asks.reduce((s, a) => s + a.ask, 0);
  const awarded = candidate?.finalAmount == null ? null : Number(candidate.finalAmount);

  const savedBy = new Map(awards.map((a) => [a.rtbItemId, Number(a.amount)]));
  const saved = items.some((i) => savedBy.has(i.id));
  // Vorbelegen nur, solange es keine Entscheidung gibt, die sie überschreiben würde.
  const prefill = awarded == null || saved ? {} : proportionalAwards(asks, awarded);

  return {
    cycleKey,
    awarded,
    requested,
    saved,
    closedReason: potWindowClosedReason(cycleKey, now),
    rows: items.map((i, n) => ({
      rtbItemId: i.id,
      name: i.name,
      kind: i.kind,
      artId: i.artId,
      ask: asks[n]!.ask,
      amount: savedBy.get(i.id) ?? prefill[i.id] ?? 0,
    })),
  };
}

export interface SaveRtbAwardsInput {
  valueStreamId: string;
  cycleKey: string;
  amounts: { rtbItemId: string; amount: number }[];
}

/**
 * Schreibt die Aufteilung. Der Deckel wird **in derselben Transaktion** gegen
 * den Zuspruch gerechnet — nicht nur im Client, sonst überschreiten zwei
 * gleichzeitig Aufteilende ihn, ohne dass es jemand merkt.
 */
export async function saveRtbAwards(
  ctx: RequestContext,
  input: SaveRtbAwardsInput,
): Promise<Result<{ assigned: number; remaining: number }>> {
  const mctx = toMutationContext(ctx);

  const closed = potWindowClosedReason(input.cycleKey, new Date());
  if (closed) return err({ kind: "conflict" as const, reason: closed });

  return withAuditedTransaction(mctx, async (tx) => {
    const denied = await assertRtbManage(ctx, tx, mctx.tenantId, input.valueStreamId, "awards");
    if (denied) return denied;

    const items = await tx.runTheBusinessItem.findMany({
      where: { tenantId: mctx.tenantId, valueStreamId: input.valueStreamId, active: true },
      select: { id: true },
    });
    const known = new Set(items.map((i) => i.id));
    // Eine fremde Position mitzuschreiben hieße, das Geld eines anderen
    // Wertstroms zu verteilen.
    if (input.amounts.some((a) => !known.has(a.rtbItemId))) {
      return err({
        kind: "conflict" as const,
        reason: "Eine der Positionen gehört nicht zu diesem Wertstrom.",
      });
    }

    const candidate = await tx.budgetCandidate.findFirst({
      where: {
        tenantId: mctx.tenantId,
        kind: "rtb",
        valueStreamId: input.valueStreamId,
        finalAmount: { not: null },
        round: { cycleKey: input.cycleKey },
      },
      select: { finalAmount: true },
    });
    if (candidate?.finalAmount == null) {
      return err({
        kind: "conflict" as const,
        reason:
          "Für dieses Halbjahr ist dem Wertstrom noch nichts zugesprochen — es gibt nichts aufzuteilen.",
      });
    }
    const awarded = Number(candidate.finalAmount);

    const assigned = input.amounts.reduce((s, a) => s + a.amount, 0);
    const reason = awardSplitDeniedReason(assigned, awarded);
    if (reason) return err({ kind: "conflict" as const, reason });

    for (const a of input.amounts) {
      const existing = await tx.rtbItemAward.findFirst({
        where: { rtbItemId: a.rtbItemId, cycleKey: input.cycleKey },
        select: { id: true },
      });
      if (existing) {
        await tx.rtbItemAward.update({
          where: { id: existing.id },
          data: { amount: a.amount, updatedBy: mctx.actorId },
        });
      } else {
        await tx.rtbItemAward.create({
          data: {
            tenantId: mctx.tenantId,
            rtbItemId: a.rtbItemId,
            cycleKey: input.cycleKey,
            amount: a.amount,
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
      }
    }

    return ok({
      result: { assigned, remaining: awarded - assigned },
      audit: {
        action: "rtb_item.awards_set" as const,
        resourceType: "value_stream" as const,
        resourceId: input.valueStreamId,
        changes: { cycleKey: { before: null, after: input.cycleKey } },
      },
    });
  });
}
