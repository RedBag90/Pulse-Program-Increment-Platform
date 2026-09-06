/**
 * Geteilter PB-Listen-Loader (Spec F-C1).
 *
 * „Welche Epics stehen auf dem PB-Liste (vorgemerkt + budgeting-reif)" lag früher
 * mehrfach dupliziert; hier **einmal**. Der Kosten-Richtwert je Epic wird aus den
 * Artefakten abgeleitet (approved Lean Business Case → Σ costSlices; sonst approved
 * Benefit-Hypothese → tenant-konfigurierter Default-Aufwand), nicht mehr aus einem
 * manuellen Einreichungsfeld — s. `@/modules/work/domain/pb-submission`.
 *
 * Das frühere Pflichtvorhaben-Konzept (`mandatory`, Off-the-top-Abzug) ist entfallen;
 *
 * `db` ist strukturell typisiert (`Pick<…>`), damit sowohl der PrismaClient als auch
 * ein Transaktions-Client (im Close-Seam) ihn erfüllen.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { derivePbInfo } from "@/modules/work/domain/pb-submission";

export interface PbListEpic {
  id: string;
  title: string;
  cost: number;
}

export interface PbList {
  ballot: PbListEpic[];
}

export async function loadPbList(
  db: Pick<PrismaClient, "initiative" | "tenant">,
  tenantId: string,
): Promise<PbList> {
  const ballotEpics = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      stagedForBudgeting: true,
      // Nur mit **freigegebenem** Lean Business Case. Eine freigegebene
      // Benefit-Hypothese reichte bis September 2026 — damit budgetierte das
      // Portfolio die Erarbeitung des Business Case selbst.
      businessCaseApprovedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      businessCase: true,
      benefitHypothesis: true,
      businessCaseApprovedAt: true,
      hypothesisApprovedAt: true,
    },
    orderBy: { title: "asc" },
  });

  return {
    ballot: ballotEpics.map((e) => ({
      id: e.id,
      title: e.title,
      cost: derivePbInfo(e).cost,
    })),
    // Pflichtvorhaben-Konzept entfällt — kein Off-the-top-Abzug mehr.
  };
}
