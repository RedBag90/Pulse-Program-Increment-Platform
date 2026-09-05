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
import { derivePbInfo, DEFAULT_HYPOTHESIS_EFFORT } from "@/modules/work/domain/pb-submission";

export interface PbListEpic {
  id: string;
  title: string;
  cost: number;
}

export interface PbList {
  ballot: PbListEpic[];
}

/**
 * Löst den tenant-konfigurierten Default-Aufwand (Kosten-Richtwert für nur-Hypothese-
 * Epics) auf; fällt ohne Konfiguration auf `DEFAULT_HYPOTHESIS_EFFORT` zurück.
 */
export async function loadDefaultHypothesisEffort(
  db: Pick<PrismaClient, "tenant">,
  tenantId: string,
): Promise<number> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { defaultHypothesisEffort: true },
  });
  return tenant?.defaultHypothesisEffort != null
    ? Number(tenant.defaultHypothesisEffort)
    : DEFAULT_HYPOTHESIS_EFFORT;
}

export async function loadPbList(
  db: Pick<PrismaClient, "initiative" | "tenant">,
  tenantId: string,
): Promise<PbList> {
  const [ballotEpics, defaultEffort] = await Promise.all([
    db.initiative.findMany({
      where: {
        tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        OR: [{ hypothesisApprovedAt: { not: null } }, { businessCaseApprovedAt: { not: null } }],
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
    }),
    loadDefaultHypothesisEffort(db, tenantId),
  ]);

  return {
    ballot: ballotEpics.map((e) => ({
      id: e.id,
      title: e.title,
      cost: derivePbInfo(e, defaultEffort).cost,
    })),
    // Pflichtvorhaben-Konzept entfällt — kein Off-the-top-Abzug mehr.
  };
}
