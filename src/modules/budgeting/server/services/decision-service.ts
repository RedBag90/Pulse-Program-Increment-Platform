/**
 * Streuzonen-Entscheidung + Report-out (Spec P4).
 *
 * Die Entscheidungsinstanz entscheidet je Streuzonen-Epic (funded / rejected /
 * deferred_with_review). Weicht sie von der **Gruppenmehrheit** ab, ist eine
 * schriftliche Begründung Pflicht (E-04). Konsens/Ablehnung werden nicht
 * entschieden (sie sind unstrittig).
 */

import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

export type DecisionOutcome = "funded" | "rejected" | "deferred_with_review";

/** Mehrheit aus Ja-Stimmen / Gruppenzahl: yes | no | none (Gleichstand). */
function majorityOf(yes: number, total: number): "yes" | "no" | "none" {
  if (yes * 2 > total) return "yes";
  if (yes * 2 < total) return "no";
  return "none";
}

export async function recordDecision(
  ctx: RequestContext,
  input: {
    roundId: string;
    epicId: string;
    outcome: DecisionOutcome;
    justification?: string | null | undefined;
    deferredCheckTask?: string | null | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { roundId, epicId, outcome, justification, deferredCheckTask } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: roundId, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: roundId });
    if (round.status !== "decided") {
      return err({
        kind: "conflict" as const,
        reason: "Entscheidungen sind nur im Status decided möglich (Runde erst dahin überführen).",
      });
    }

    // Gruppenmehrheit für dieses Epic.
    const [yes, groupCount] = await Promise.all([
      tx.groupAllocation.count({ where: { roundId, epicId, funded: true } }),
      tx.budgetGroup.count({ where: { roundId } }),
    ]);
    const majority = majorityOf(yes, groupCount);
    const deviates =
      (outcome === "funded" && majority === "no") || (outcome !== "funded" && majority === "yes");

    if (deviates && (!justification || justification.trim() === "")) {
      return err({
        kind: "conflict" as const,
        reason: "Abweichung von der Gruppenmehrheit — schriftliche Begründung ist Pflicht (E-04).",
      });
    }
    if (outcome === "deferred_with_review" && (!deferredCheckTask || deferredCheckTask.trim() === "")) {
      return err({ kind: "conflict" as const, reason: "Vertagt mit Prüfauftrag — Prüfauftrag angeben." });
    }

    await tx.budgetDecision.upsert({
      where: { roundId_epicId: { roundId, epicId } },
      create: {
        roundId,
        epicId,
        outcome,
        justification: justification ?? null,
        deferredCheckTask: deferredCheckTask ?? null,
        deviatesFromMajority: deviates,
        createdBy: mctx.actorId,
      },
      update: {
        outcome,
        justification: justification ?? null,
        deferredCheckTask: deferredCheckTask ?? null,
        deviatesFromMajority: deviates,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.decision.recorded" as const,
        resourceType: "budget_decision" as const,
        resourceId: epicId,
        changes: { outcome: { before: null, after: outcome } },
      },
    });
  });
}

export async function setReportOut(
  ctx: RequestContext,
  input: {
    groupId: string;
    costliestYesEpicId?: string | null | undefined;
    clearestNoEpicId?: string | null | undefined;
    biggestDisputeEpicId?: string | null | undefined;
    costliestYesReason?: string | null | undefined;
    clearestNoReason?: string | null | undefined;
    disputeReason?: string | null | undefined;
  },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { groupId, ...rest } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const group = await tx.budgetGroup.findFirst({
      where: { id: groupId, round: { tenantId: mctx.tenantId } },
      select: { id: true },
    });
    if (!group) return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: groupId });

    const data = {
      costliestYesEpicId: rest.costliestYesEpicId ?? null,
      clearestNoEpicId: rest.clearestNoEpicId ?? null,
      biggestDisputeEpicId: rest.biggestDisputeEpicId ?? null,
      costliestYesReason: rest.costliestYesReason ?? null,
      clearestNoReason: rest.clearestNoReason ?? null,
      disputeReason: rest.disputeReason ?? null,
    };

    await tx.groupReportOut.upsert({
      where: { groupId },
      create: { groupId, ...data },
      update: data,
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.group.updated" as const,
        resourceType: "budget_group" as const,
        resourceId: groupId,
        changes: {},
      },
    });
  });
}
