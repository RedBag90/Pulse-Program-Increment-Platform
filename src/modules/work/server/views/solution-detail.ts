/**
 * Read-Model der Solution-Detailseite (`/portfolio/solutions/[id]`): Kopf +
 * Lifecycle + Run/Grow + zugeordnete Primär-Epics. Grow = Σ Umsetzungskosten der
 * aktiven Primär-Epics (Stage < L5); Run = manuelle Baseline.
 */

import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { notDeleted } from "@/server/db/soft-delete";
import { parseBusinessCase, computeBusinessCaseTotals } from "@/modules/work/domain/business-case";
import { isHorizon, type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import { isInvestmentMode, type InvestmentMode } from "@/modules/work/domain/solution";

export interface SolutionDetailEpic {
  id: string;
  title: string;
  stageGate: string;
  cost: number;
}

export interface SolutionDetailModel {
  id: string;
  name: string;
  description: string | null;
  valueStreamId: string;
  valueStreamName: string | null;
  artId: string | null;
  artName: string | null;
  horizon: Horizon;
  investmentMode: InvestmentMode | null;
  run: number | null;
  grow: number;
  epics: SolutionDetailEpic[];
}

export async function loadSolutionDetail(
  db: PrismaClient,
  tenantId: string,
  id: string,
): Promise<SolutionDetailModel | null> {
  const s = await db.solution.findFirst({
    where: { id, tenantId, ...notDeleted },
    select: {
      id: true,
      name: true,
      description: true,
      valueStreamId: true,
      artId: true,
      horizon: true,
      investmentMode: true,
      runBaselineAmount: true,
      valueStream: { select: { name: true } },
      art: { select: { name: true } },
    },
  });
  if (!s) return null;

  const epicRows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
      primarySolutionId: id,
    },
    select: { id: true, title: true, stageGate: true, businessCase: true },
    orderBy: { title: "asc" },
  });

  let grow = 0;
  const epics: SolutionDetailEpic[] = epicRows.map((e) => {
    const cost = computeBusinessCaseTotals(parseBusinessCase(e.businessCase).current).implementationCost;
    if (e.stageGate !== "L5") grow += cost;
    return { id: e.id, title: e.title, stageGate: e.stageGate, cost };
  });

  return {
    id: s.id,
    name: s.name,
    description: s.description,
    valueStreamId: s.valueStreamId,
    valueStreamName: s.valueStream?.name ?? null,
    artId: s.artId,
    artName: s.art?.name ?? null,
    horizon: (isHorizon(s.horizon) ? s.horizon : "h1") as Horizon,
    investmentMode: isInvestmentMode(s.investmentMode) ? s.investmentMode : null,
    run: s.runBaselineAmount != null ? Number(s.runBaselineAmount) : null,
    grow,
    epics,
  };
}
