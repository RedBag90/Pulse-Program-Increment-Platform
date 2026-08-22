/**
 * Gruppen-Erfassung (Hybrid, Spec P3/F3.1): der Moderator trägt je (Gruppe, Epic)
 * ein Ja/Nein bis MVP ein. Nur solange die Runde `running` ist.
 */

import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

export async function setGroupAllocation(
  ctx: RequestContext,
  input: { roundId: string; groupId: string; epicId: string; funded: boolean },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { roundId, groupId, epicId, funded } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: roundId, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: roundId });
    if (round.status !== "running") {
      return err({ kind: "conflict" as const, reason: "Erfassung ist nur möglich, während die Runde läuft." });
    }

    const group = await tx.budgetGroup.findFirst({
      where: { id: groupId, roundId },
      select: { id: true },
    });
    if (!group) return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: groupId });

    await tx.groupAllocation.upsert({
      where: { groupId_epicId: { groupId, epicId } },
      create: { roundId, groupId, epicId, funded },
      update: { funded },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.group.captured" as const,
        resourceType: "budget_group" as const,
        resourceId: groupId,
        changes: { epicId: { before: null, after: epicId }, funded: { before: null, after: funded } },
      },
    });
  });
}
