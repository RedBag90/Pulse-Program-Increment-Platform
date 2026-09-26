/**
 * **Gespeicherte Netzplan-Positionen im Umsetzungsmodul.**
 *
 * Das Schwestermodul `work/server/services/breakdown-layout.ts` tut dasselbe
 * für den Epic-Breakdown; dort ist der Bezugspunkt ein **Epic**, hier eine
 * **ART**. Der Netzplan im Umsetzungsmodul hat kein Epic — sein Ausschnitt ist
 * (ART, PI-Fenster), und das Fenster verschiebt sich, die ART nicht.
 *
 * Wie drüben: tenant-weit gespeichert, alle sehen dasselbe Bild. Ein Knoten
 * ohne gespeicherte Position fällt auf die berechnete zurück — damit
 * funktioniert es auch für ARTs, in denen noch nie jemand gezogen hat, und
 * für Features, die es beim letzten Speichern noch nicht gab.
 *
 * **Nur für die Topologie.** In der Zeitachse ist die Position die Aussage
 * (sie *ist* das PI); dort wird sie gesetzt, nicht gespeichert.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, InitiativeId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";

export interface ArtPositionInput {
  initiativeId: InitiativeId;
  x: number;
  y: number;
}

export interface SaveArtGraphLayoutInput {
  artId: ArtId;
  positions: readonly ArtPositionInput[];
}

/** Die gespeicherten Positionen einer ART als `Map<initiativeId, {x, y}>`. */
export async function loadArtGraphLayout(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
): Promise<Map<string, { x: number; y: number }>> {
  const rows = await db.artGraphPosition.findMany({
    where: { tenantId, artId },
    select: { initiativeId: true, x: true, y: true },
  });
  const m = new Map<string, { x: number; y: number }>();
  for (const r of rows) m.set(r.initiativeId, { x: r.x, y: r.y });
  return m;
}

/**
 * Schreibt Positionen fort — atomisch, mit **einem** Prüfpfad-Eintrag.
 *
 * Kein Feld-Diff je Knoten: wer fünf Kästen verschiebt, erzeugt sonst fünf
 * Zeilen, die niemand liest.
 */
export async function saveArtGraphLayout(
  ctx: RequestContext,
  input: SaveArtGraphLayoutInput,
): Promise<Result<{ count: number }>> {
  const mctx = toMutationContext(ctx);
  const { artId, positions } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    for (const p of positions) {
      await tx.artGraphPosition.upsert({
        where: { artId_initiativeId: { artId, initiativeId: p.initiativeId } },
        update: { x: p.x, y: p.y, updatedBy: mctx.actorId },
        create: {
          tenantId: mctx.tenantId,
          artId,
          initiativeId: p.initiativeId,
          x: p.x,
          y: p.y,
          updatedBy: mctx.actorId,
        },
      });
    }
    return ok({
      result: { count: positions.length },
      audit: {
        action: "initiative.updated",
        resourceType: "art",
        resourceId: artId,
        changes: { artGraphLayout: { before: null, after: `${positions.length} position(s)` } },
      },
    });
  });
}

/**
 * **Wirft die Handarbeit weg** — „Neu anordnen".
 *
 * Ohne sie gäbe es nur Anlegen und Überschreiben: wer sein Bild einmal verzogen
 * hat, käme nicht mehr zur automatischen Anordnung zurück, weil jede
 * gespeicherte Position die berechnete bedingungslos schlägt.
 *
 * Räumt dabei die Zeilen gelöschter Features mit weg — `loadArtGraphLayout`
 * liest alle Zeilen der ART, ungefiltert gegen ihre heutigen Features.
 */
export async function clearArtGraphLayout(
  ctx: RequestContext,
  input: { artId: ArtId },
): Promise<Result<{ count: number }>> {
  const mctx = toMutationContext(ctx);

  return withAuditedTransaction(mctx, async (tx) => {
    const { count } = await tx.artGraphPosition.deleteMany({
      where: { tenantId: mctx.tenantId, artId: input.artId },
    });
    return ok({
      result: { count },
      audit: {
        action: "initiative.updated",
        resourceType: "art",
        resourceId: input.artId,
        changes: { artGraphLayout: { before: `${count} position(s)`, after: null } },
      },
    });
  });
}
