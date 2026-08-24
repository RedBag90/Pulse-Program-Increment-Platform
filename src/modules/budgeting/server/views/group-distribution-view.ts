/**
 * Read-Model der Gruppen-Verteilseite (`/budgeting/periods/[id]/distribute/[groupId]`):
 * alle Ballot-Kandidaten (Epics + Run-the-Business) als eine Liste, gruppierbar
 * nach Value Stream, mit Budget-Info je Epic, dem aktuellen €-Betrag der Gruppe
 * und den Editier-/Einreich-Rechten (mitglieds-scoped, Fenster-abhängig).
 */

import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";

export interface DistributionCandidate {
  id: string;
  kind: string; // epic | rtb
  title: string;
  ask: number;
  amount: number;
  valueStreamId: string | null;
  valueStreamName: string | null;
  info: {
    problemStatement: string | null;
    mvpCut: string | null;
    riskRating: string | null;
    ifNotFunded: string | null;
  } | null;
}

export interface GroupDistributionModel {
  roundId: string;
  status: string;
  groupId: string;
  groupName: string;
  submitted: boolean;
  distributable: number;
  mandatorySum: number;
  candidates: DistributionCandidate[];
  totalAllocated: number;
  deadline: Date | null;
  deadlinePassed: boolean;
  /** Mitglied + Fenster offen. */
  canEdit: boolean;
  /** Sprecher/Einreicher + Fenster offen. */
  canSubmit: boolean;
}

export async function loadGroupDistribution(
  db: PrismaClient,
  principal: Principal,
  roundId: string,
  groupId: string,
): Promise<GroupDistributionModel | null> {
  const group = await db.budgetGroup.findFirst({
    where: { id: groupId, roundId, round: { tenantId: principal.tenantId } },
    select: {
      id: true,
      name: true,
      submittedAt: true,
      spokespersonId: true,
      round: { select: { id: true, status: true, poolTotal: true, submissionDeadline: true } },
      members: { select: { userId: true, isSubmitter: true } },
    },
  });
  if (!group) return null;

  const [candidates, allocations, ballot, valueStreams] = await Promise.all([
    db.budgetCandidate.findMany({
      where: { roundId },
      select: { id: true, kind: true, title: true, ask: true, epicId: true, valueStreamId: true },
      orderBy: { title: "asc" },
    }),
    db.groupAllocation.findMany({
      where: { groupId, candidateId: { not: null } },
      select: { candidateId: true, amount: true },
    }),
    loadRoundBallot(db, principal.tenantId),
    db.valueStream.findMany({ where: { tenantId: principal.tenantId }, select: { id: true, name: true } }),
  ]);

  // Budget-Info je Epic-Kandidat (die denormalisierten Candidate-Felder tragen
  // nur Titel/ask — die qualitative Info kommt frisch vom Epic).
  const epicIds = candidates.map((c) => c.epicId).filter((x): x is string => x != null);
  const epics = epicIds.length
    ? await db.initiative.findMany({
        where: { id: { in: epicIds }, level: InitiativeLevel.EPIC },
        select: {
          id: true,
          problemStatement: true,
          mvpCut: true,
          riskRating: true,
          ifNotFunded: true,
        },
      })
    : [];

  const amountByCandidate = new Map(
    allocations.map((a) => [a.candidateId as string, Number(a.amount)]),
  );
  const vsName = new Map(valueStreams.map((v) => [v.id, v.name]));
  const infoByEpic = new Map(epics.map((e) => [e.id, e]));

  const candidateViews: DistributionCandidate[] = candidates.map((c) => {
    const epicInfo = c.epicId ? infoByEpic.get(c.epicId) : undefined;
    return {
      id: c.id,
      kind: c.kind,
      title: c.title,
      ask: Number(c.ask),
      amount: amountByCandidate.get(c.id) ?? 0,
      valueStreamId: c.valueStreamId,
      valueStreamName: c.valueStreamId ? (vsName.get(c.valueStreamId) ?? null) : null,
      info: epicInfo
        ? {
            problemStatement: epicInfo.problemStatement,
            mvpCut: epicInfo.mvpCut,
            riskRating: epicInfo.riskRating,
            ifNotFunded: epicInfo.ifNotFunded,
          }
        : null,
    };
  });

  const now = new Date();
  const deadline = group.round.submissionDeadline;
  const deadlinePassed = deadline != null && now.getTime() > deadline.getTime();
  const submitted = group.submittedAt != null;
  const isMember = group.members.some((m) => m.userId === principal.id);
  const isSubmitter =
    group.spokespersonId === principal.id ||
    group.members.some((m) => m.userId === principal.id && m.isSubmitter);
  const windowOpen = group.round.status === "running" && !submitted && !deadlinePassed;

  return {
    roundId: group.round.id,
    status: group.round.status,
    groupId: group.id,
    groupName: group.name,
    submitted,
    distributable: Number(group.round.poolTotal) - ballot.mandatorySum,
    mandatorySum: ballot.mandatorySum,
    candidates: candidateViews,
    totalAllocated: candidateViews.reduce((s, c) => s + c.amount, 0),
    deadline,
    deadlinePassed,
    canEdit: isMember && windowOpen,
    canSubmit: isSubmitter && windowOpen,
  };
}
