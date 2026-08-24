/**
 * Geteilter Ballot-/Pflicht-Loader (Spec F-C1).
 *
 * „Welche Epics stehen auf dem PB-Ballot (vorgemerkt, nicht Pflicht) und welche
 * Pflichtvorhaben ziehen den Topf ab" lag bisher 3–4× dupliziert (round-view,
 * zones-view, round-service-Close). Hier **einmal**. Der verteilbare Topf
 * (`poolTotal − mandatorySum`) bleibt beim Aufrufer, weil `poolTotal`
 * runden-spezifisch ist.
 *
 * `db` ist strukturell typisiert (`Pick<…, "initiative">`), damit sowohl der
 * PrismaClient als auch ein Transaktions-Client (im Close-Seam) ihn erfüllen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

export interface BallotEpic {
  id: string;
  title: string;
  cost: number;
}

export interface RoundBallot {
  ballot: BallotEpic[];
  mandatoryCount: number;
  mandatorySum: number;
}

export async function loadRoundBallot(
  db: Pick<PrismaClient, "initiative">,
  tenantId: string,
): Promise<RoundBallot> {
  const [ballotEpics, mandatoryEpics] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        mandatory: false,
      },
      select: { id: true, title: true, costToMvp: true },
      orderBy: { title: "asc" },
    }),
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, mandatory: true },
      select: { costToMvp: true },
    }),
  ]);

  return {
    ballot: ballotEpics.map((e) => ({
      id: e.id,
      title: e.title,
      cost: e.costToMvp ? Number(e.costToMvp) : 0,
    })),
    mandatoryCount: mandatoryEpics.length,
    mandatorySum: mandatoryEpics.reduce((s, e) => s + (e.costToMvp ? Number(e.costToMvp) : 0), 0),
  };
}
