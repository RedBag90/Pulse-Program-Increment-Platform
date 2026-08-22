import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { resolveActiveCycle } from "@/modules/budgeting/domain/budget-cycle";
import { checkGroupCut, type CutWarning } from "@/modules/budgeting/domain/group-cut";
import { getRoundForCycle } from "@/modules/budgeting/server/services/round-service";

export interface RoundGroupView {
  id: string;
  name: string;
  spokespersonId: string | null;
  members: {
    id: string;
    userId: string;
    team: string | null;
    isSubmitter: boolean;
    hasRead: boolean;
  }[];
}

export interface RoundSetupModel {
  cycleKey: string;
  canManage: boolean;
  round: {
    id: string;
    status: string;
    poolTotal: number;
    plannedAt: Date | null;
    decisionAuthorityIds: string[];
  } | null;
  groups: RoundGroupView[];
  cutWarnings: CutWarning[];
  /** Vorgemerkte + einreichungsbereite Epics = Ballot-Kandidaten. */
  ballotCount: number;
  /** Pflichtvorhaben (vom Topf abzuziehen, nicht auf dem Ballot). */
  mandatoryCount: number;
  mandatorySum: number;
}

/**
 * Runden-Setup-Read-Model: die Runde des aktiven Halbjahres-Cycles (oder null),
 * ihre Gruppen + Mitglieder, die Schnitt-Warnungen und die Ballot-/Pflicht-Zählung.
 */
export async function loadRoundSetup(
  db: PrismaClient,
  principal: Principal,
): Promise<RoundSetupModel> {
  const tenant = await db.tenant.findUnique({
    where: { id: principal.tenantId },
    select: { activeBudgetCycle: true },
  });
  const cycleKey = resolveActiveCycle(
    { activeBudgetCycle: tenant?.activeBudgetCycle ?? null },
    new Date(),
  );
  const canManage = hasCapability(principal, "budget.round.manage", { tenantId: principal.tenantId });

  const round = await getRoundForCycle(db, principal.tenantId, cycleKey);

  const groups: RoundGroupView[] = (round?.groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    spokespersonId: g.spokespersonId,
    members: g.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      team: m.team,
      isSubmitter: m.isSubmitter,
      hasRead: m.hasRead,
    })),
  }));

  const cutWarnings = checkGroupCut(
    groups.map((g) => ({ id: g.id, name: g.name, spokespersonId: g.spokespersonId })),
    groups.flatMap((g) =>
      g.members.map((m) => ({ groupId: g.id, userId: m.userId, team: m.team, isSubmitter: m.isSubmitter })),
    ),
  );

  const [ballotCount, mandatoryEpics] = await Promise.all([
    db.initiative.count({
      where: {
        tenantId: principal.tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        stagedForBudgeting: true,
        mandatory: false,
      },
    }),
    db.initiative.findMany({
      where: {
        tenantId: principal.tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        mandatory: true,
      },
      select: { costToMvp: true },
    }),
  ]);

  const mandatorySum = mandatoryEpics.reduce((s, e) => s + (e.costToMvp ? Number(e.costToMvp) : 0), 0);

  return {
    cycleKey,
    canManage,
    round: round
      ? {
          id: round.id,
          status: round.status,
          poolTotal: Number(round.poolTotal),
          plannedAt: round.plannedAt,
          decisionAuthorityIds: round.decisionAuthorityIds,
        }
      : null,
    groups,
    cutWarnings,
    ballotCount,
    mandatoryCount: mandatoryEpics.length,
    mandatorySum,
  };
}
