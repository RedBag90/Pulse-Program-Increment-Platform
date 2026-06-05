import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId } from "@/domain/types";
import type { InitiativeLevel } from "@/domain/types";
import { listEpics } from "@/server/services/epic";
import { listGoals } from "@/server/services/target-goal";
import { getBudgetingBoard, getValueStreamBudgets } from "@/server/services/budgeting";
import { listImpedimentsForArts } from "@/server/services/impediment";
import { computeStructureGap, computePracticeAdoption } from "@/server/services/transformation";
import {
  buildPortfolioOverviewModel,
  type PortfolioOverview,
  type PortfolioOverviewInputs,
} from "@/server/views/portfolio-overview";

// Re-export the model types so existing imports against this file keep working.
// New code should import from `@/server/views/portfolio-overview` directly.
export {
  STAGE_GATES,
  STAGE_GATE_LABEL,
  type StageGate,
  type OverviewEpicCard,
  type OverviewGoal,
  type OverviewBudget,
  type OverviewFundingPeriod,
  type OverviewFunding,
  type OverviewActivePi,
  type OverviewRecentEvent,
  type PortfolioOverview,
} from "@/server/views/portfolio-overview";

/**
 * Loads every input the Portfolio Overview page-model needs in one parallel
 * wave. Pure I/O — no reshape, no business derivation. The companion builder
 * `buildPortfolioOverviewModel` (in `views/`) owns the reshape; this loader
 * exists separately so the builder is testable against in-memory fixtures.
 */
export async function loadPortfolioOverviewInputs(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioOverviewInputs> {
  const [epics, goals, board, vsBudgets, arts, activePis, structureGap, practiceAdoption] =
    await Promise.all([
      listEpics(db, tenantId),
      listGoals(db, tenantId),
      getBudgetingBoard(db, tenantId),
      getValueStreamBudgets(db, tenantId),
      db.art.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true },
      }),
      db.programIncrement.findMany({
        where: { tenantId, status: "active" },
        select: { id: true, name: true, endDate: true },
        orderBy: { endDate: "asc" },
      }),
      computeStructureGap(db, tenantId),
      computePracticeAdoption(db, tenantId),
    ]);

  const artIds = arts.map((a) => a.id as ArtId);
  const impedimentRows =
    artIds.length === 0
      ? []
      : await listImpedimentsForArts(db, tenantId, artIds, { status: "open" });

  return {
    epics,
    goals,
    board,
    vsBudgets,
    activePis,
    impedimentsOpen: impedimentRows.length,
    structureGap,
    practiceAdoption,
    now: new Date(),
  };
}

/**
 * Convenience wrapper: load + build, returned as one DTO. The page calls this;
 * tests prefer `buildPortfolioOverviewModel` with fixtures.
 */
export async function getPortfolioOverview(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PortfolioOverview> {
  return buildPortfolioOverviewModel(await loadPortfolioOverviewInputs(db, tenantId));
}

// Helper: counts non-deleted Features in a given level — kept here so the
// overview can include legacy "by-level" KPIs if the Hero variant ever needs
// them again. Currently unused; left exported for the next iteration.
export async function countInitiativesAtLevel(
  db: PrismaClient,
  tenantId: TenantId,
  level: InitiativeLevel,
): Promise<number> {
  return db.initiative.count({
    where: { tenantId, level, deletedAt: null },
  });
}
