/**
 * Selbst-Verteilung durch Gruppenmitglieder (Kachel-Modell). Mitglieds-scoped:
 * die maßgebliche Prüfung ist die Gruppen-Zugehörigkeit (`BudgetGroupMember`),
 * nicht eine Portfolio-Rolle. Schreiben nur solange die Runde `running` ist, vor
 * der Deadline und bevor die Gruppe eingereicht hat. Einreichen darf nur der
 * Sprecher (oder ein `isSubmitter`).
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

interface GroupGuard {
  roundId: string;
  status: string;
  submissionDeadline: Date | null;
  submittedAt: Date | null;
  spokespersonId: string | null;
  members: { userId: string; isSubmitter: boolean }[];
}

/** Lädt die Gruppe + Runden-Status + Mitglieder (Tenant-scoped). */
async function loadGroupGuard(
  tx: Prisma.TransactionClient,
  tenantId: string,
  groupId: string,
): Promise<GroupGuard | null> {
  const g = await tx.budgetGroup.findFirst({
    where: { id: groupId, round: { tenantId } },
    select: {
      spokespersonId: true,
      submittedAt: true,
      round: { select: { id: true, status: true, submissionDeadline: true } },
      members: { select: { userId: true, isSubmitter: true } },
    },
  });
  if (!g) return null;
  return {
    roundId: g.round.id,
    status: g.round.status,
    submissionDeadline: g.round.submissionDeadline,
    submittedAt: g.submittedAt,
    spokespersonId: g.spokespersonId,
    members: g.members,
  };
}

/** Fenster offen = Runde läuft, vor Deadline, nicht bereits eingereicht. */
function windowClosedReason(g: GroupGuard, now: Date): string | null {
  if (g.status !== "running") return "Die Verteilung ist nur möglich, solange die Runde läuft.";
  if (g.submittedAt != null) return "Die Gruppe hat ihre Verteilung bereits eingereicht.";
  if (g.submissionDeadline != null && now.getTime() > g.submissionDeadline.getTime()) {
    return "Die Abgabe-Deadline ist verstrichen.";
  }
  return null;
}

/** Setzt (oder aktualisiert) den €-Betrag einer Gruppe für einen Kandidaten. */
export async function setGroupAmount(
  ctx: RequestContext,
  input: { groupId: string; candidateId: string; amount: number },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const now = new Date();
  return withAuditedTransaction(mctx, async (tx) => {
    const g = await loadGroupGuard(tx, mctx.tenantId, input.groupId);
    if (!g) return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.groupId });
    if (!g.members.some((m) => m.userId === mctx.actorId)) {
      return err({ kind: "forbidden" as const, reason: "Nur Mitglieder dieser Gruppe dürfen verteilen." });
    }
    const closed = windowClosedReason(g, now);
    if (closed) return err({ kind: "conflict" as const, reason: closed });

    // Kandidat muss zu dieser Runde gehören.
    const candidate = await tx.budgetCandidate.findFirst({
      where: { id: input.candidateId, roundId: g.roundId },
      select: { id: true },
    });
    if (!candidate) {
      return err({ kind: "not_found" as const, resourceType: "BudgetCandidate", id: input.candidateId });
    }

    const row = await tx.groupAllocation.upsert({
      where: { groupId_candidateId: { groupId: input.groupId, candidateId: input.candidateId } },
      update: { amount: input.amount },
      create: {
        roundId: g.roundId,
        groupId: input.groupId,
        candidateId: input.candidateId,
        amount: input.amount,
      },
      select: { id: true },
    });

    return ok({
      result: { id: row.id },
      audit: {
        action: "budget.group.contributed" as const,
        resourceType: "budget_group" as const,
        resourceId: input.groupId,
        changes: { candidateId: { before: null, after: input.candidateId } },
      },
    });
  });
}

/** Reicht die Verteilung der Gruppe ein (nur Sprecher / `isSubmitter`). */
export async function submitGroupDistribution(
  ctx: RequestContext,
  input: { groupId: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const now = new Date();
  return withAuditedTransaction(mctx, async (tx) => {
    const g = await loadGroupGuard(tx, mctx.tenantId, input.groupId);
    if (!g) return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.groupId });

    const isSpokesperson = g.spokespersonId === mctx.actorId;
    const isSubmitter = g.members.some((m) => m.userId === mctx.actorId && m.isSubmitter);
    if (!isSpokesperson && !isSubmitter) {
      return err({
        kind: "forbidden" as const,
        reason: "Nur der Sprecher (oder ein Einreicher) darf die Verteilung einreichen.",
      });
    }
    const closed = windowClosedReason(g, now);
    if (closed) return err({ kind: "conflict" as const, reason: closed });

    await tx.budgetGroup.update({
      where: { id: input.groupId },
      data: { submittedAt: now, submittedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.group.submitted" as const,
        resourceType: "budget_group" as const,
        resourceId: input.groupId,
        changes: { submittedAt: { before: null, after: now.toISOString() } },
      },
    });
  });
}
