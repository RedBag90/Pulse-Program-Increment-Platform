/**
 * **Der Grow-Anteil einer Solution** — Σ Umsetzungskosten ihrer Primär-Epics,
 * plus deren Anzahl.
 *
 * Er blieb in Work, als die Solution nach Core zog (ADR-0022): hier werden
 * Epics und Business Cases gelesen, und das ist Arbeit. Eine Solutions-Fläche
 * ohne Work-Modul zeigt deshalb keine Grow-Spalte — so, wie sie ohne Budgeting
 * keine Run-Spalte zeigt.
 *
 * **Gezählt wird ab L3.1.** Ein Epic darf seinen Lean Business Case ab L2
 * führen (`contentForGate`), aber dort ist er *in Arbeit* — eine Rechnung, die
 * noch niemand freigegeben hat. Der Filter stand bis zuletzt auf
 * `stageGate !== "L5"`, zählte damit ab L0 und trug bei einer Solution
 * 270.000 € von 334.000 € (81 %) aus einem einzigen L2-Epic bei. Diese Zahl
 * steht neben der Run-Kachel, die aus echten Betriebskosten kommt; ein
 * unbeschlossener Entwurf wog dort so schwer wie geflossenes Geld.
 *
 * Dieselbe Grenze zieht `isPbEligible` (`work/domain/pb-submission.ts`) und
 * führt `mayHoldAllocation` als Zahl (`FIRST_FUNDABLE_STEP = "L3.1"`).
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";
import { isPbEligible } from "@/modules/work/domain/pb-submission";

export interface SolutionGrow {
  /** Σ Umsetzungskosten der freigegebenen, noch nicht abgeschlossenen Epics. */
  grow: number;
  /** Alle Primär-Epics — auch die unreifen und die abgeschlossenen. */
  epicCount: number;
}

export interface SolutionGrowEpic {
  id: string;
  title: string;
  stageGate: string;
  /** `null`, solange der Business Case nicht freigegeben ist. */
  cost: number | null;
}

/**
 * Trägt dieses Epic zum Grow bei?
 *
 * Zwei Bedingungen, und beide sind eine eigene Aussage: **freigegeben**, sonst
 * ist die Zahl ein Entwurf — und **nicht abgeschlossen**, denn Grow misst, was
 * gerade investiert wird, nicht was einmal investiert wurde.
 */
export function countsTowardGrow(e: {
  stageGate: string;
  businessCaseApprovedAt: Date | null;
}): boolean {
  return isPbEligible(e) && e.stageGate !== "L5";
}

/** Die Felder, die die Regel braucht — Vertrag für beide Leser unten. */
export interface GrowEpicFacts {
  primarySolutionId: string | null;
  stageGate: string;
  businessCaseApprovedAt: Date | null;
  businessCase: unknown;
}

/** Die Umsetzungskosten aus dem Business Case, oder 0 ohne Freigabe. */
function growCost(e: GrowEpicFacts): number {
  if (!countsTowardGrow(e)) return 0;
  return computeBusinessCaseTotals(parseBusinessCase(e.businessCase).current).implementationCost;
}

/** Summiert Grow und Anzahl je Solution. */
export function growByPrimarySolution(epics: readonly GrowEpicFacts[]): Map<string, SolutionGrow> {
  const out = new Map<string, SolutionGrow>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    const cell = out.get(e.primarySolutionId) ?? { grow: 0, epicCount: 0 };
    cell.epicCount += 1;
    cell.grow += growCost(e);
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
    // Der Reifegrad-Filter sitzt in `countsTowardGrow`, nicht in der Abfrage:
    // `epicCount` zaehlt **alle** Primaer-Epics, auch die unreifen. Nur das
    // Geld hat eine Schwelle.
    select: {
      primarySolutionId: true,
      stageGate: true,
      businessCaseApprovedAt: true,
      businessCase: true,
    },
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
    select: {
      id: true,
      title: true,
      stageGate: true,
      businessCaseApprovedAt: true,
      businessCase: true,
    },
    orderBy: { title: "asc" },
  });
  let grow = 0;
  const epics = rows.map((e) => {
    // Der Reiter listet **alle** zugeordneten Epics — auch die, die noch keine
    // freigegebene Zahl haben. Die zeigen dann keinen Betrag statt einer Null:
    // „noch nicht freigegeben" ist etwas anderes als „kostet nichts".
    const cost = isPbEligible(e)
      ? computeBusinessCaseTotals(parseBusinessCase(e.businessCase).current).implementationCost
      : null;
    if (
      countsTowardGrow({ stageGate: e.stageGate, businessCaseApprovedAt: e.businessCaseApprovedAt })
    )
      grow += cost ?? 0;
    return { id: e.id, title: e.title, stageGate: e.stageGate, cost };
  });
  return { epics, grow };
}
