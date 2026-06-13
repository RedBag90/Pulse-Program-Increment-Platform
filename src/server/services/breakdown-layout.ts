/**
 * Persistenz der Netzplan-Node-Positionen (Roadmap-P5).
 *
 * Layouts sind tenant-weit gespeichert — alle User sehen dasselbe Layout.
 * Per (epicId, initiativeId) gibt es maximal eine Position; ein zweites
 * Speichern updated den bestehenden Eintrag (Upsert).
 *
 * Knoten ohne persistierte Position fallen client-seitig auf den dagre-
 * Auto-Layout zurueck. Damit funktioniert das Feature auch fuer Epics,
 * die noch nie gespeichert wurden, und fuer brandneue Quick-Add-Knoten
 * innerhalb eines schon gespeicherten Epics.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId, InitiativeId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

export interface PositionInput {
  initiativeId: InitiativeId;
  x: number;
  y: number;
}

export interface SaveBreakdownLayoutInput {
  epicId: EpicId;
  positions: readonly PositionInput[];
}

/**
 * Liefert die persistierten Positionen aller Child-Features eines Epics
 * als `Map<initiativeId, {x, y}>`. Leere Map, wenn fuer dieses Epic
 * noch keine Position gespeichert wurde.
 */
export async function loadBreakdownLayout(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: EpicId,
): Promise<Map<string, { x: number; y: number }>> {
  const rows = await db.initiativeGraphPosition.findMany({
    where: { tenantId, epicId },
    select: { initiativeId: true, x: true, y: true },
  });
  const m = new Map<string, { x: number; y: number }>();
  for (const r of rows) m.set(r.initiativeId, { x: r.x, y: r.y });
  return m;
}

/**
 * Upsertet eine Liste von Positionen fuer ein Epic — atomisch in einer
 * Transaktion. Ein einziges Audit-Event mit der Anzahl der gespeicherten
 * Positionen, kein Field-Diff pro Knoten (zu noisy).
 */
export async function saveBreakdownLayout(
  ctx: RequestContext,
  input: SaveBreakdownLayoutInput,
): Promise<Result<{ count: number }>> {
  const mctx = toMutationContext(ctx);
  const { epicId, positions } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    for (const p of positions) {
      await tx.initiativeGraphPosition.upsert({
        where: { epicId_initiativeId: { epicId, initiativeId: p.initiativeId } },
        update: {
          x: p.x,
          y: p.y,
          updatedBy: mctx.actorId,
        },
        create: {
          tenantId: mctx.tenantId,
          epicId,
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
        resourceType: "initiative",
        resourceId: epicId,
        changes: { breakdownLayout: { before: null, after: `${positions.length} position(s)` } },
      },
    });
  });
}
