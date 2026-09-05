/**
 * Der **ART-Epic-Budget eines ARTs** und seine Verteilung auf ART-Epics.
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
import { loadArtEpicBudget } from "@/modules/budgeting/server/services/art-epic-budget";
import { artPotAccessDeniedReason } from "@/modules/budgeting/domain/budget-access";
import { mergeEpicAllocation } from "@/modules/budgeting/server/services/epic-allocation";

export interface ArtEpicAllocationRow {
  epicId: string;
  amount: number;
  /** Richtwert, eingefroren beim ersten Zuteilen. */
  ask: number;
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

    // Vier Wege führen zum Verteilen: der RTE **dieses** ARTs über
    // `art_budget.distribute`, `rtb_item.manage` samt Finance-Bypass des
    // Wertstroms, und der Produkt-Manager der Primär-Solution **dieses** Epics.
    // Die Regel selbst steht rein in `artPotAccessDeniedReason`.
    const [vs, epic] = await Promise.all([
      tx.valueStream.findFirst({
        where: { id: art.valueStreamId, tenantId: mctx.tenantId },
        select: { financeApproverId: true },
      }),
      tx.initiative.findFirst({
        where: { id: input.epicId, tenantId: mctx.tenantId },
        select: { primarySolution: { select: { productManagerId: true } } },
      }),
    ]);
    const denied = artPotAccessDeniedReason({
      isValueStreamFinance: vs?.financeApproverId === ctx.principal.id,
      isEpicSolutionProductManager:
        epic?.primarySolution?.productManagerId === ctx.principal.id &&
        epic?.primarySolution?.productManagerId != null,
      hasRtbCapability: authorizeResource(ctx.principal, "rtb_item.manage", {
        tenantId: mctx.tenantId,
        valueStreamId: art.valueStreamId,
      }).ok,
      hasArtDistributeCapability: authorizeResource(ctx.principal, "art_budget.distribute", {
        tenantId: mctx.tenantId,
        artId: input.artId,
      }).ok,
    });
    if (denied) return err({ kind: "forbidden" as const, reason: denied });

    const existing = await tx.artEpicAllocation.findFirst({
      where: { artId: input.artId, epicId: input.epicId, cycleKey: input.cycleKey },
      select: { id: true, amount: true, ask: true },
    });

    // Das Budget dieses Halbjahres — gebraucht für den Deckel **und** für den
    // Rest, den der Aufrufer zurückbekommt. Deshalb vor dem Zweig, nicht darin.
    // Dieselbe Funktion, die auch die Fläche liest: eine Zahl, eine Rechnung.
    const pot = (await loadArtEpicBudget(tx, mctx.tenantId, input.artId, input.cycleKey)).total;

    if (input.amount === 0) {
      if (existing) await tx.artEpicAllocation.delete({ where: { id: existing.id } });
      await mergeEpicAllocation(tx, {
        source: "art_epic_budget" as const,
        tenantId: mctx.tenantId,
        epicId: input.epicId,
        cycleKey: input.cycleKey,
        amount: 0,
        actorId: mctx.actorId,
      });
    } else {
      // Deckel gegen den Rahmen — mit dem Stand aus derselben Transaktion.
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
        source: "art_epic_budget" as const,
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
      // Rahmen minus Verteiltes. Stand hier nur `-verteilt` — der Wert wurde von
      // keiner Fläche gelesen (die UI nimmt `pot.remaining` aus `loadArtEpicBudget`),
      // war aber falsch, sobald jemand ihn benutzt hätte.
      result: {
        remaining: pot - after.reduce((s, a) => s + Number(a.amount), 0),
      },
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

export interface SaveArtEpicAllocationsInput {
  artId: string;
  cycleKey: string;
  amounts: { epicId: string; amount: number; ask: number }[];
}

/**
 * Die ganze Verteilliste in **einem** Zug.
 *
 * `setArtEpicAllocation` schreibt eine Zeile und prüft den Deckel gegen die
 * Summe aller anderen — bei zeilenweiser Bedienung heißt das: ein Roundtrip je
 * Betrag, und wer zwei Zeilen tauschen will, muss die Reihenfolge kennen, in
 * der der Deckel es erlaubt. Hier gilt der Deckel gegen die Summe **der
 * Eingabe**, wie beim Aufteilen des Zuspruchs (`saveRtbAwards`).
 *
 * Die Einzelfunktion bleibt: sie trägt die Rechte- und Fenster-Prüfung, und die
 * Actions-Schicht ruft für einen einzelnen Betrag weiterhin sie.
 */
export async function saveArtEpicAllocations(
  ctx: RequestContext,
  input: SaveArtEpicAllocationsInput,
  now: Date = new Date(),
): Promise<Result<{ remaining: number }>> {
  const closed = potWindowClosedReason(input.cycleKey, now);
  if (closed) return err({ kind: "conflict" as const, reason: closed });

  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({
      where: { id: input.artId, tenantId: mctx.tenantId },
      select: { valueStreamId: true },
    });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: input.artId });

    const vs = await tx.valueStream.findFirst({
      where: { id: art.valueStreamId, tenantId: mctx.tenantId },
      select: { financeApproverId: true },
    });
    const denied = artPotAccessDeniedReason({
      isValueStreamFinance: vs?.financeApproverId === ctx.principal.id,
      // Sammelspeichern bewegt mehrere Epics; der zeilenweise Weg des
      // Produkt-Managers trägt das nicht. Er behält den Einzelweg.
      isEpicSolutionProductManager: false,
      hasRtbCapability: authorizeResource(ctx.principal, "rtb_item.manage", {
        tenantId: mctx.tenantId,
        valueStreamId: art.valueStreamId,
      }).ok,
      hasArtDistributeCapability: authorizeResource(ctx.principal, "art_budget.distribute", {
        tenantId: mctx.tenantId,
        artId: input.artId,
      }).ok,
    });
    if (denied) return err({ kind: "forbidden" as const, reason: denied });

    const pot = (await loadArtEpicBudget(tx, mctx.tenantId, input.artId, input.cycleKey)).total;
    const sum = input.amounts.reduce((s, a) => s + a.amount, 0);
    if (sum > pot) {
      return err({
        kind: "conflict" as const,
        reason: `Die Summe überschreitet das ART-Epic-Budget um ${Math.round(sum - pot)} €.`,
      });
    }

    const existing = await tx.artEpicAllocation.findMany({
      where: { tenantId: mctx.tenantId, artId: input.artId, cycleKey: input.cycleKey },
      select: { id: true, epicId: true },
    });
    const byEpic = new Map(existing.map((e) => [e.epicId, e.id]));

    for (const a of input.amounts) {
      const id = byEpic.get(a.epicId);
      if (a.amount === 0) {
        if (id) await tx.artEpicAllocation.delete({ where: { id } });
      } else if (id) {
        await tx.artEpicAllocation.update({
          where: { id },
          data: { amount: a.amount, ask: a.ask, updatedBy: mctx.actorId },
        });
      } else {
        await tx.artEpicAllocation.create({
          data: {
            tenantId: mctx.tenantId,
            artId: input.artId,
            epicId: a.epicId,
            cycleKey: input.cycleKey,
            amount: a.amount,
            ask: a.ask,
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
      }
      await mergeEpicAllocation(tx, {
        source: "art_epic_budget" as const,
        tenantId: mctx.tenantId,
        epicId: a.epicId,
        cycleKey: input.cycleKey,
        amount: a.amount,
        actorId: mctx.actorId,
      });
    }

    return ok({
      result: { remaining: pot - sum },
      audit: {
        action: "art.epic_allocation.set" as const,
        resourceType: "art" as const,
        resourceId: input.artId,
        changes: { cycleKey: { before: null, after: input.cycleKey } },
      },
    });
  });
}
