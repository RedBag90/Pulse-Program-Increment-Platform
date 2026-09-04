/**
 * Read-Model der Finance-Übersicht (Tab „Verteilungs-Übersicht"): Matrix Gruppen
 * × Kandidaten mit €-Beträgen + Abgabestatus, plus je Kandidat der Median-
 * Vorschlag für die Finalisierung. Sichtbar für admin/finance.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { Principal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { loadPbList } from "@/modules/budgeting/server/services/pb-list";
import { median } from "@/modules/budgeting/domain/finalize";

export interface OverviewGroup {
  id: string;
  name: string;
  submitted: boolean;
}

export interface OverviewCandidate {
  id: string;
  kind: string;
  title: string;
  ask: number;
  valueStreamName: string | null;
  /**
   * Für die Gliederung, nicht für die Rechnung — beim Lesen aufgelöst, anders
   * als der auf dem Kandidaten eingefrorene Wertstrom.
   */
  solutionName: string | null;
  /** groupId → €-Vorschlag der Gruppe. */
  amounts: Record<string, number>;
  /** Median der abgegebenen Vorschläge (Finalisierungs-Vorbefüllung). */
  suggestion: number;
  finalAmount: number | null;
}

export interface DistributionOverviewModel {
  roundId: string;
  status: string;
  distributable: number;
  groups: OverviewGroup[];
  candidates: OverviewCandidate[];
  submittedCount: number;
  deadlinePassed: boolean;
  canFinalize: boolean;
}

export async function loadDistributionOverview(
  db: PrismaClient,
  principal: Principal,
  roundId: string,
): Promise<DistributionOverviewModel | null> {
  const round = await db.budgetRound.findFirst({
    where: { id: roundId, tenantId: principal.tenantId },
    select: { id: true, status: true, poolTotal: true, submissionDeadline: true },
  });
  if (!round) return null;

  const [groups, candidates, allocations, ballot, valueStreams, epicSolutions, rtbSolutions] =
    await Promise.all([
      db.budgetGroup.findMany({
        where: { roundId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, submittedAt: true },
      }),
      db.budgetCandidate.findMany({
        where: { roundId },
        orderBy: { title: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          ask: true,
          valueStreamId: true,
          epicId: true,
          rtbItemId: true,
          finalAmount: true,
        },
      }),
      db.groupAllocation.findMany({
        where: { roundId, candidateId: { not: null } },
        select: { groupId: true, candidateId: true, amount: true },
      }),
      loadPbList(db, principal.tenantId),
      db.valueStream.findMany({
        where: { tenantId: principal.tenantId },
        select: { id: true, name: true },
      }),
      db.initiative.findMany({
        where: { tenantId: principal.tenantId, primarySolutionId: { not: null } },
        select: { id: true, primarySolution: { select: { name: true } } },
      }),
      db.runTheBusinessItem.findMany({
        where: { tenantId: principal.tenantId, solutionId: { not: null } },
        select: { id: true, solution: { select: { name: true } } },
      }),
    ]);

  const vsName = new Map(valueStreams.map((v) => [v.id, v.name]));
  const epicSol = new Map(epicSolutions.map((e) => [e.id, e.primarySolution?.name ?? null]));
  const rtbSol = new Map(rtbSolutions.map((r) => [r.id, r.solution?.name ?? null]));
  const solutionOf = (c: { epicId: string | null; rtbItemId: string | null }): string | null =>
    (c.epicId ? epicSol.get(c.epicId) : c.rtbItemId ? rtbSol.get(c.rtbItemId) : null) ?? null;
  const submittedGroupIds = new Set(groups.filter((g) => g.submittedAt != null).map((g) => g.id));

  // amounts[candidateId][groupId] = amount
  const byCandidate = new Map<string, Record<string, number>>();
  for (const a of allocations) {
    const cid = a.candidateId as string;
    const row = byCandidate.get(cid) ?? {};
    row[a.groupId] = Number(a.amount);
    byCandidate.set(cid, row);
  }

  const candidateViews: OverviewCandidate[] = candidates.map((c) => {
    const amounts = byCandidate.get(c.id) ?? {};
    // Median nur über die Vorschläge der abgegebenen Gruppen.
    const submittedAmounts = Object.entries(amounts)
      .filter(([gid]) => submittedGroupIds.has(gid))
      .map(([, v]) => v);
    return {
      id: c.id,
      kind: c.kind,
      title: c.title,
      ask: Number(c.ask),
      valueStreamName: c.valueStreamId ? (vsName.get(c.valueStreamId) ?? null) : null,
      solutionName: solutionOf(c),
      amounts,
      suggestion: median(submittedAmounts),
      finalAmount: c.finalAmount != null ? Number(c.finalAmount) : null,
    };
  });

  const now = new Date();

  return {
    roundId: round.id,
    status: round.status,
    distributable: Number(round.poolTotal) - ballot.mandatorySum,
    groups: groups.map((g) => ({ id: g.id, name: g.name, submitted: g.submittedAt != null })),
    candidates: candidateViews,
    submittedCount: submittedGroupIds.size,
    deadlinePassed:
      round.submissionDeadline != null && now.getTime() > round.submissionDeadline.getTime(),
    canFinalize: hasCapability(principal, "budget.manage", { tenantId: principal.tenantId }),
  };
}
