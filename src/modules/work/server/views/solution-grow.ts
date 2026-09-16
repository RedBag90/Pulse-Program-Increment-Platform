/**
 * **Der Grow-Anteil einer Solution** — Σ Umsetzungskosten der aktiven
 * Primär-Epics (Reifegrad < L5), plus deren Anzahl.
 *
 * Er blieb in Work, als die Solution nach Core zog (ADR-0022): hier werden
 * Epics und Business Cases gelesen, und das ist Arbeit. Eine Solutions-Fläche
 * ohne Work-Modul zeigt deshalb keine Grow-Spalte — so, wie sie ohne Budgeting
 * keine Run-Spalte zeigt.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";

export interface SolutionGrow {
  /** Σ Umsetzungskosten aktiver Primär-Epics (Stage < L5). */
  grow: number;
  /** Alle Primär-Epics, auch die abgeschlossenen. */
  epicCount: number;
}

export interface SolutionGrowEpic {
  id: string;
  title: string;
  stageGate: string;
  cost: number;
}

/** Summiert Grow und Anzahl je Solution aus den aktiven Primär-Epics. */
export function growByPrimarySolution(
  epics: { primarySolutionId: string | null; stageGate: string; businessCase: unknown }[],
): Map<string, SolutionGrow> {
  const out = new Map<string, SolutionGrow>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    const cell = out.get(e.primarySolutionId) ?? { grow: 0, epicCount: 0 };
    cell.epicCount += 1;
    if (e.stageGate !== "L5") {
      cell.grow += computeBusinessCaseTotals(
        parseBusinessCase(e.businessCase).current,
      ).implementationCost;
    }
    out.set(e.primarySolutionId, cell);
  }
  return out;
}

/** Grow je Solution für eine Menge von Solution-Ids. */
export async function loadSolutionGrow(
  db: PrismaClient,
  tenantId: string,
  solutionIds: readonly string[],
): Promise<Map<string, SolutionGrow>> {
  if (solutionIds.length === 0) return new Map();
  const epics = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      primarySolutionId: { in: [...solutionIds] },
    },
    select: { primarySolutionId: true, stageGate: true, businessCase: true },
  });
  return growByPrimarySolution(epics);
}

/** Die Primär-Epics **einer** Solution, für den Epics-Reiter der Detailseite. */
export async function loadSolutionEpics(
  db: PrismaClient,
  tenantId: string,
  solutionId: string,
): Promise<{ epics: SolutionGrowEpic[]; grow: number }> {
  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      primarySolutionId: solutionId,
    },
    select: { id: true, title: true, stageGate: true, businessCase: true },
    orderBy: { title: "asc" },
  });
  let grow = 0;
  const epics = rows.map((e) => {
    const cost = computeBusinessCaseTotals(
      parseBusinessCase(e.businessCase).current,
    ).implementationCost;
    if (e.stageGate !== "L5") grow += cost;
    return { id: e.id, title: e.title, stageGate: e.stageGate, cost };
  });
  return { epics, grow };
}
