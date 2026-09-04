/**
 * Beteiligten-Roster einer Kachel (Schritt 1 vor der Gruppenbildung). Nur solange
 * die Runde `draft` ist editierbar.
 */

import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

export async function addParticipant(
  ctx: RequestContext,
  input: { roundId: string; userId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.roundId, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round)
      return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.roundId });
    if (round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Beteiligte sind nur im Status draft änderbar.",
      });
    }

    // Idempotent: (roundId, userId) ist unique.
    const row = await tx.budgetParticipant.upsert({
      where: { roundId_userId: { roundId: input.roundId, userId: input.userId } },
      update: {},
      create: {
        tenantId: mctx.tenantId,
        roundId: input.roundId,
        userId: input.userId,
        createdBy: mctx.actorId,
      },
      select: { id: true },
    });

    return ok({
      result: { id: row.id },
      audit: {
        action: "budget.participant.added" as const,
        resourceType: "budget_participant" as const,
        resourceId: row.id,
        changes: { userId: { before: null, after: input.userId } },
      },
    });
  });
}

export async function removeParticipant(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.budgetParticipant.findFirst({
      where: { id: input.id, round: { tenantId: mctx.tenantId } },
      select: { id: true, round: { select: { status: true } } },
    });
    if (!row)
      return err({ kind: "not_found" as const, resourceType: "BudgetParticipant", id: input.id });
    if (row.round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Beteiligte sind nur im Status draft änderbar.",
      });
    }
    await tx.budgetParticipant.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "budget.participant.removed" as const,
        resourceType: "budget_participant" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}
