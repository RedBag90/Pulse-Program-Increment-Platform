/**
 * Der **Veränderungsrahmen eines ARTs** und seine Verteilung auf ART-Epics.
 *
 * Der Rahmen ist keine eigene Größe: er ist die Summe der finalen Beträge der
 * `art_change`-Positionen dieses ARTs aus den Kacheln des Halbjahres. Der
 * Wertstrom entscheidet in der Kachel, **wie groß** er ist; hier wird
 * entschieden, **wofür**.
 *
 * Mehrere Kacheln desselben Zyklus addieren sich — `BudgetRound` ist
 * ausdrücklich nicht eindeutig je `(tenantId, cycleKey)`.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";
import { potWindowClosedReason } from "@/modules/budgeting/domain/art-pot-window";
import { mergeEpicAllocation } from "@/modules/budgeting/server/services/epic-allocation";

export interface ArtPot {
  cycleKey: string;
  /** Σ der finalen Beträge der Veränderungsrahmen-Positionen dieses ARTs. */
  total: number;
  /** Was der ART davon vergeben hat. */
  distributed: number;
  /** Rest — verfällt nicht und wandert nicht; er wird ausgewiesen. */
  remaining: number;
  /** Warum gerade nicht verteilt werden darf; `null` = offen. */
  closedReason: string | null;
}

export interface ArtEpicAllocationRow {
  epicId: string;
  amount: number;
  /** Richtwert, eingefroren beim ersten Zuteilen. */
  ask: number;
}

/** Der Rahmen eines ARTs für ein Halbjahr, samt bereits Verteiltem. */
export async function loadArtPot(
  db: PrismaClient,
  tenantId: TenantId,
  artId: string,
  cycleKey: string,
  now: Date = new Date(),
): Promise<ArtPot> {
  // `BudgetCandidate` kennt nur `kind: "rtb"`; die Art der Position steht an ihr.
  const changeItems = await db.runTheBusinessItem.findMany({
    where: { tenantId, artId, kind: "art_change" },
    select: { id: true },
  });

  const [finals, allocations] = await Promise.all([
    changeItems.length === 0
      ? Promise.resolve([])
      : db.budgetCandidate.findMany({
          where: {
            tenantId,
            kind: "rtb",
            rtbItemId: { in: changeItems.map((i) => i.id) },
            finalAmount: { not: null },
            round: { cycleKey },
          },
          select: { finalAmount: true },
        }),
    db.artEpicAllocation.findMany({
      where: { tenantId, artId, cycleKey },
      select: { amount: true },
    }),
  ]);

  const total = finals.reduce((s, f) => s + Number(f.finalAmount), 0);
  const distributed = allocations.reduce((s, a) => s + Number(a.amount), 0);

  return {
    cycleKey,
    total,
    distributed,
    remaining: total - distributed,
    closedReason: potWindowClosedReason(cycleKey, now),
  };
}

/** Die Zuteilungen eines ARTs im Halbjahr. */
export async function loadArtEpicAllocations(
  db: PrismaClient,
  tenantId: TenantId,
  artId: string,
  cycleKey: string,
): Promise<ArtEpicAllocationRow[]> {
  const rows = await db.artEpicAllocation.findMany({
    where: { tenantId, artId, cycleKey },
    select: { epicId: true, amount: true, ask: true },
  });
  return rows.map((r) => ({
    epicId: r.epicId,
    amount: Number(r.amount),
    ask: Number(r.ask),
  }));
}

export interface SetArtEpicAllocationInput {
  artId: string;
  epicId: string;
  cycleKey: string;
  amount: number;
  /** Richtwert des Epics — wird nur beim **ersten** Zuteilen eingefroren. */
  ask: number;
}

/**
 * Setzt den Betrag eines ART-Epics.
 *
 * Drei Regeln, alle **in der Transaktion**:
 *
 *  - Das Fenster muss offen sein (laufendes oder nächstes Halbjahr).
 *  - Die Summe darf den Rahmen nicht überschreiten. Die Prüfung sitzt hier und
 *    nicht nur im Client — sonst überschreiten zwei gleichzeitig Verteilende
 *    den Deckel, ohne dass es jemand merkt.
 *  - Betrag 0 entfernt die Zeile **und** den Kartenwert; eine 0-Zelle wäre eine
 *    Zuteilung von nichts, keine fehlende Zuteilung.
 *
 * Der Richtwert friert beim ersten Zuteilen ein: sonst folgte die Verteilliste
 * live dem Business Case und verschöbe sich zwischen zwei Besuchen.
 */
export async function setArtEpicAllocation(
  ctx: RequestContext,
  input: SetArtEpicAllocationInput,
  now: Date = new Date(),
): Promise<Result<{ remaining: number }>> {
  const mctx = toMutationContext(ctx);
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return err({ kind: "conflict" as const, reason: "Betrag muss eine Zahl ≥ 0 sein." });
  }

  const closed = potWindowClosedReason(input.cycleKey, now);
  if (closed) return err({ kind: "conflict" as const, reason: closed });

  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: input.artId, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!art) {
      return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });
    }

    // Verteilt wird der Rahmen **für** den ART, nicht vom ART: die Rechte
    // folgen `rtb_item.manage` samt Finance-Bypass des Wertstroms.
    const vs = await tx.valueStream.findFirst({
      where: { id: art.valueStreamId, tenantId: mctx.tenantId },
      select: { financeApproverId: true },
    });
    const isFinance = vs?.financeApproverId === ctx.principal.id;
    if (!isFinance) {
      const decision = authorizeResource(ctx.principal, "rtb_item.manage", {
        tenantId: mctx.tenantId,
        valueStreamId: art.valueStreamId,
      });
      if (!decision.ok) {
        return err({
          kind: "forbidden" as const,
          reason:
            "Nur Wertstrom-Owner, Finance-Partei oder Portfolio-Management dürfen den ART-Rahmen verteilen.",
        });
      }
    }

    const existing = await tx.artEpicAllocation.findFirst({
      where: { artId: input.artId, epicId: input.epicId, cycleKey: input.cycleKey },
      select: { id: true, amount: true, ask: true },
    });

    if (input.amount === 0) {
      if (existing) await tx.artEpicAllocation.delete({ where: { id: existing.id } });
      await mergeEpicAllocation(tx, {
        tenantId: mctx.tenantId,
        epicId: input.epicId,
        cycleKey: input.cycleKey,
        amount: 0,
        actorId: mctx.actorId,
      });
    } else {
      // Deckel gegen den Rahmen — mit dem Stand aus derselben Transaktion.
      const changeItems = await tx.runTheBusinessItem.findMany({
        where: { tenantId: mctx.tenantId, artId: input.artId, kind: "art_change" },
        select: { id: true },
      });
      const finals =
        changeItems.length === 0
          ? []
          : await tx.budgetCandidate.findMany({
              where: {
                tenantId: mctx.tenantId,
                kind: "rtb",
                rtbItemId: { in: changeItems.map((i) => i.id) },
                finalAmount: { not: null },
                round: { cycleKey: input.cycleKey },
              },
              select: { finalAmount: true },
            });
      const pot = finals.reduce((s, f) => s + Number(f.finalAmount), 0);

      const others = await tx.artEpicAllocation.findMany({
        where: {
          tenantId: mctx.tenantId,
          artId: input.artId,
          cycleKey: input.cycleKey,
          ...(existing ? { NOT: { id: existing.id } } : {}),
        },
        select: { amount: true },
      });
      const sum = others.reduce((s, a) => s + Number(a.amount), 0) + input.amount;
      if (sum > pot) {
        return err({
          kind: "conflict" as const,
          reason: `Die Summe überschreitet den Rahmen um ${Math.round(sum - pot)} €.`,
        });
      }

      if (existing) {
        await tx.artEpicAllocation.update({
          where: { id: existing.id },
          data: { amount: input.amount, updatedBy: mctx.actorId },
        });
      } else {
        await tx.artEpicAllocation.create({
          data: {
            tenantId: mctx.tenantId,
            artId: input.artId,
            epicId: input.epicId,
            cycleKey: input.cycleKey,
            amount: input.amount,
            ask: input.ask,
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
      }

      await mergeEpicAllocation(tx, {
        tenantId: mctx.tenantId,
        epicId: input.epicId,
        cycleKey: input.cycleKey,
        amount: input.amount,
        actorId: mctx.actorId,
      });
    }

    const after = await tx.artEpicAllocation.findMany({
      where: { tenantId: mctx.tenantId, artId: input.artId, cycleKey: input.cycleKey },
      select: { amount: true },
    });

    return ok({
      result: { remaining: after.reduce((s, a) => s - Number(a.amount), 0) },
      audit: {
        action: "art.epic_allocation.set" as const,
        resourceType: "art" as const,
        resourceId: input.artId,
        changes: {
          [`${input.epicId}:${input.cycleKey}`]: {
            before: existing ? Number(existing.amount) : null,
            after: input.amount === 0 ? null : input.amount,
          },
        },
      },
    });
  });
}
