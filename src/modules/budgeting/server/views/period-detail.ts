/**
 * Read-Model der Kachel-Detailseite (`/budgeting/periods/[id]`), Setup-Tab:
 * Rahmen + Beteiligte-Roster + Gruppen + Ballot-Kuratierung. Impurer Loader
 * (eine parallele Welle), die Ableitung (verteilbarer Topf, kuratierbare Epics)
 * ist trivial und inline.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { getRound } from "@/modules/budgeting/server/services/round-service";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { listTenantUserLabels } from "@/server/services/tenant-users";

export interface PeriodMemberView {
  id: string;
  userId: string;
  label: string;
  isSubmitter: boolean;
  hasRead: boolean;
}

export interface PeriodGroupView {
  id: string;
  name: string;
  spokespersonId: string | null;
  members: PeriodMemberView[];
}

export interface PeriodDetailModel {
  round: {
    id: string;
    cycleKey: string;
    status: string;
    poolTotal: number;
    startDate: Date | null;
    endDate: Date | null;
    submissionDeadline: Date | null;
  };
  /** Verteilbarer Topf = poolTotal − mandatorySum. */
  distributable: number;
  mandatoryCount: number;
  mandatorySum: number;
  participants: { id: string; userId: string; label: string }[];
  groups: PeriodGroupView[];
  /** Budgeting-reife Epics, die noch NICHT auf dem Ballot dieser Kachel sind. */
  eligibleEpics: { id: string; title: string; cost: number }[];
  /** Bereits kuratierte Epic-Kandidaten dieser Kachel. */
  epicCandidates: { id: string; epicId: string; title: string; ask: number }[];
  /** Tenant-Nutzer (Id → E-Mail) für Beteiligte-/Mitglieder-/Sprecher-Auswahl. */
  users: { id: string; label: string }[];
  canManage: boolean;
}

export async function loadPeriodDetail(
  db: PrismaClient,
  principal: Principal,
  roundId: string,
): Promise<PeriodDetailModel | null> {
  const round = await getRound(db, principal.tenantId, roundId);
  if (!round) return null;

  const [ballot, participants, candidates, userLabels] = await Promise.all([
    loadRoundBallot(db, principal.tenantId),
    db.budgetParticipant.findMany({ where: { roundId }, select: { id: true, userId: true } }),
    db.budgetCandidate.findMany({
      where: { roundId, kind: "epic" },
      select: { id: true, epicId: true, title: true, ask: true },
    }),
    listTenantUserLabels(db, principal.tenantId),
  ]);

  const labelOf = (id: string): string => userLabels[id] ?? id;
  const candidateEpicIds = new Set(candidates.map((c) => c.epicId).filter((x): x is string => x != null));

  const users = Object.entries(userLabels)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    round: {
      id: round.id,
      cycleKey: round.cycleKey,
      status: round.status,
      poolTotal: Number(round.poolTotal),
      startDate: round.startDate,
      endDate: round.endDate,
      submissionDeadline: round.submissionDeadline,
    },
    distributable: Number(round.poolTotal) - ballot.mandatorySum,
    mandatoryCount: ballot.mandatoryCount,
    mandatorySum: ballot.mandatorySum,
    participants: participants.map((p) => ({ id: p.id, userId: p.userId, label: labelOf(p.userId) })),
    groups: round.groups.map((g) => ({
      id: g.id,
      name: g.name,
      spokespersonId: g.spokespersonId,
      members: g.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        label: labelOf(m.userId),
        isSubmitter: m.isSubmitter,
        hasRead: m.hasRead,
      })),
    })),
    eligibleEpics: ballot.ballot.filter((e) => !candidateEpicIds.has(e.id)),
    epicCandidates: candidates.map((c) => ({
      id: c.id,
      epicId: c.epicId ?? "",
      title: c.title,
      ask: Number(c.ask),
    })),
    users,
    canManage: hasCapability(principal, "budget.round.manage", { tenantId: principal.tenantId }),
  };
}
