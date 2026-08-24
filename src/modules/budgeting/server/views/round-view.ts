import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { resolveActiveCycle } from "@/modules/budgeting/domain/budget-cycle";
import { checkGroupCut, type CutWarning } from "@/modules/budgeting/domain/group-cut";
import { getRoundForCycle } from "@/modules/budgeting/server/services/round-service";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { listTenantUserLabels } from "@/server/services/tenant-users";

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
  /** Tenant-Nutzer (Id → E-Mail) für Mitglieder-/Sprecher-Auswahl. */
  users: { id: string; label: string }[];
  cutWarnings: CutWarning[];
  /** Die tatsächlichen Ballot-Epics (vorgemerkt, nicht Pflicht) — gespiegelt. */
  ballot: { id: string; title: string; cost: number }[];
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

  const userLabels = await listTenantUserLabels(db, principal.tenantId);
  const users = Object.entries(userLabels)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

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

  const { ballot, mandatoryCount, mandatorySum } = await loadRoundBallot(db, principal.tenantId);

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
    users,
    cutWarnings,
    ballot,
    ballotCount: ballot.length,
    mandatoryCount,
    mandatorySum,
  };
}
