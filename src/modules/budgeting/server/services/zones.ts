/**
 * Lädt, was die Zonen-Rechnung braucht: Runde, PB-Liste, Stimmen.
 *
 * Der Falter dazu wohnt in `domain/epic-zones.ts`; hier steht nur der Weg zu
 * den Zahlen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { buildZonesModel, type ZonesModel } from "@/modules/budgeting/domain/epic-zones";
import { getRound } from "@/modules/budgeting/server/services/round-service";
import { loadPbList } from "@/modules/budgeting/server/services/pb-list";

/** Lädt Runde + PB-Liste + Stimmen und baut das Zonen-Modell. */
export async function loadZonesModel(
  db: PrismaClient,
  tenantId: string,
  roundId: string,
): Promise<ZonesModel | null> {
  const round = await getRound(db, tenantId, roundId);
  if (!round) return null;

  const [ballot, votesRaw] = await Promise.all([
    loadPbList(db, tenantId),
    db.groupAllocation.findMany({
      where: { roundId, epicId: { not: null } },
      select: { groupId: true, epicId: true, funded: true },
    }),
  ]);

  // epicId ist im Kachel-Modell nullbar (Legacy-Spalte); der Alt-Zonen-Flow
  // arbeitet nur mit den Epic-Zeilen.
  const votes = votesRaw.map((v) => ({ groupId: v.groupId, epicId: v.epicId!, funded: v.funded }));

  const distributable = Number(round.poolTotal);

  return buildZonesModel({
    roundId,
    status: round.status,
    groups: round.groups.map((g) => ({ id: g.id, name: g.name })),
    ballot: ballot.ballot,
    votes,
    distributable,
  });
}
