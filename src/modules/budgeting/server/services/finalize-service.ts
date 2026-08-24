/**
 * Finance-Finalisierung + Roll-Forward (Kachel-Modell, Phase 4).
 *
 * - `closeDistribution`: running→decided (keine Gruppen-Edits mehr).
 * - `finalizePeriod`: decided→closed. Setzt je Kandidat `finalAmount`; für
 *   **Epic**-Kandidaten wird zusätzlich `BudgetAllocation[cycleKey]` gemergt
 *   (App-weite Kontinuität); `reserveAmount = (pool − mandatory) − Σ final`.
 * - `startNextPeriod`: legt die Folge-Kachel an (Reserve-Übertrag via
 *   `createRound`) und kopiert Beteiligte + Gruppen (inkl. Sprecher/Mitglieder).
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import { computeReserve } from "@/modules/budgeting/domain/finalize";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { createRound } from "@/modules/budgeting/server/services/round-service";
import { halfYearKey, addHalfYears } from "@/modules/core/kernel/domain/calendar";

export async function closeDistribution(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.id });
    if (round.status !== "running") {
      return err({ kind: "conflict" as const, reason: "Nur eine laufende Runde lässt sich schließen." });
    }
    await tx.budgetRound.update({
      where: { id: input.id },
      data: { status: "decided", updatedBy: mctx.actorId },
    });
    return ok({
      result: undefined,
      audit: {
        action: "budget.round.decided" as const,
        resourceType: "budget_round" as const,
        resourceId: input.id,
        changes: { status: { before: "running", after: "decided" } },
      },
    });
  });
}

export async function finalizePeriod(
  ctx: RequestContext,
  input: { id: string; finals: { candidateId: string; amount: number }[] },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { status: true, cycleKey: true, poolTotal: true },
    });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.id });
    if (round.status !== "decided") {
      return err({ kind: "conflict" as const, reason: "Erst die Verteilung schließen, dann finalisieren." });
    }

    const candidates = await tx.budgetCandidate.findMany({
      where: { roundId: input.id },
      select: { id: true, kind: true, epicId: true },
    });
    const candById = new Map(candidates.map((c) => [c.id, c]));

    let sumFinal = 0;
    for (const f of input.finals) {
      const cand = candById.get(f.candidateId);
      if (!cand) continue;
      sumFinal += f.amount;

      await tx.budgetCandidate.update({
        where: { id: f.candidateId },
        data: { finalAmount: f.amount, updatedBy: mctx.actorId },
      });

      // Epic-Kandidaten: BudgetAllocation für den Cycle mergen (App-Kontinuität).
      if (cand.kind === "epic" && cand.epicId) {
        const existing = await tx.budgetAllocation.findUnique({
          where: { epicId: cand.epicId },
          select: { allocations: true },
        });
        const alloc = parsePeriodAmountMap(existing?.allocations);
        alloc[round.cycleKey] = f.amount;
        await tx.budgetAllocation.upsert({
          where: { epicId: cand.epicId },
          update: { allocations: alloc as unknown as Prisma.InputJsonValue, updatedBy: mctx.actorId },
          create: {
            tenantId: mctx.tenantId,
            epicId: cand.epicId,
            priority: 0,
            allocations: alloc as unknown as Prisma.InputJsonValue,
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
      }
    }

    const ballot = await loadRoundBallot(tx, mctx.tenantId);
    const distributable = Number(round.poolTotal) - ballot.mandatorySum;
    const reserve = computeReserve(distributable, [sumFinal]);

    await tx.budgetRound.update({
      where: { id: input.id },
      data: { status: "closed", reserveAmount: reserve, updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.period.finalized" as const,
        resourceType: "budget_round" as const,
        resourceId: input.id,
        changes: { status: { before: "decided", after: "closed" } },
      },
    });
  });
}

/** Kopiert Beteiligte + Gruppen (inkl. Sprecher/Mitglieder) in die neue Runde. */
async function copySetup(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fromRoundId: string,
  toRoundId: string,
  actorId: string,
): Promise<void> {
  const [participants, groups] = await Promise.all([
    tx.budgetParticipant.findMany({ where: { roundId: fromRoundId }, select: { userId: true } }),
    tx.budgetGroup.findMany({
      where: { roundId: fromRoundId },
      select: {
        name: true,
        spokespersonId: true,
        members: { select: { userId: true, team: true, isSubmitter: true, seniority: true } },
      },
    }),
  ]);

  if (participants.length > 0) {
    await tx.budgetParticipant.createMany({
      data: participants.map((p) => ({
        tenantId,
        roundId: toRoundId,
        userId: p.userId,
        createdBy: actorId,
      })),
    });
  }

  for (const g of groups) {
    const created = await tx.budgetGroup.create({
      data: { roundId: toRoundId, name: g.name, spokespersonId: g.spokespersonId },
      select: { id: true },
    });
    if (g.members.length > 0) {
      await tx.budgetGroupMember.createMany({
        data: g.members.map((m) => ({
          groupId: created.id,
          userId: m.userId,
          team: m.team,
          isSubmitter: m.isSubmitter,
          seniority: m.seniority,
        })),
      });
    }
  }
}

export async function startNextPeriod(
  ctx: RequestContext,
  input: { fromRoundId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);

  const from = await ctx.db.budgetRound.findFirst({
    where: { id: input.fromRoundId, tenantId: mctx.tenantId },
    select: { endDate: true },
  });
  if (!from) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.fromRoundId });

  const start = from.endDate ?? new Date();
  const end = addHalfYears(start, 1);

  // createRound trägt die Reserve der zuletzt geschlossenen Runde in den Topf.
  const created = await createRound(ctx, {
    cycleKey: halfYearKey(start),
    poolTotal: 0,
    decisionAuthorityIds: [],
    startDate: start,
    endDate: end,
    submissionDeadline: end,
  });
  if (!created.ok) return created;
  const newId = created.value.id;

  // Setup übernehmen (eigene Transaktion).
  const copy = await withAuditedTransaction(mctx, async (tx) => {
    await copySetup(tx, mctx.tenantId, input.fromRoundId, newId, mctx.actorId);
    return ok({
      result: { id: newId },
      audit: {
        action: "budget.round.created" as const,
        resourceType: "budget_round" as const,
        resourceId: newId,
        changes: { copiedFrom: { before: null, after: input.fromRoundId } },
      },
    });
  });
  if (!copy.ok) return copy;

  return ok({ id: newId });
}
