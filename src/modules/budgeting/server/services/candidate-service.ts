/**
 * Ballot-Kandidaten einer Kachel (Kachel-Modell). Ein Kandidat ist ein Epic ODER
 * eine Run-the-Business-Position. `valueStreamId`/`artId` werden denormalisiert
 * mitgeführt (für die VS-/ART-Ableitung). Kuratierung + RtB-Snapshot nur in
 * `draft`; ab `running` eingefroren.
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

/**
 * Materialisiert die **RtB**-Kandidaten einer Kachel aus den **aktiven**
 * Run-the-Business-Positionen aller Value Streams (beim Start, in derselben tx).
 * Idempotent je (roundId, rtbItemId). Epic-Kandidaten stammen aus der Setup-
 * Kuratierung; ab `running` ist der Kandidatensatz eingefroren.
 */
export async function materializeRtbCandidates(
  tx: Prisma.TransactionClient,
  tenantId: string,
  roundId: string,
  actorId: string,
): Promise<void> {
  const items = await tx.runTheBusinessItem.findMany({
    where: { tenantId, active: true },
    select: { id: true, name: true, plannedAmount: true, valueStreamId: true },
  });
  for (const it of items) {
    const data = {
      title: it.name,
      ask: it.plannedAmount,
      valueStreamId: it.valueStreamId,
      updatedBy: actorId,
    };
    await tx.budgetCandidate.upsert({
      where: { roundId_rtbItemId: { roundId, rtbItemId: it.id } },
      update: data,
      create: {
        ...data,
        kind: "rtb",
        tenantId,
        roundId,
        rtbItemId: it.id,
        artId: null,
        createdBy: actorId,
      },
    });
  }
}

/** Fügt ein Epic als Ballot-Kandidat zu dieser Kachel hinzu (Kuratierung). */
export async function addEpicCandidate(
  ctx: RequestContext,
  input: { roundId: string; epicId: string },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.roundId, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.roundId });
    if (round.status !== "draft") {
      return err({ kind: "conflict" as const, reason: "Der Ballot ist nur im Status draft kuratierbar." });
    }

    const epic = await tx.initiative.findFirst({
      where: {
        id: input.epicId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        mandatory: false,
      },
      select: { id: true, title: true, costToMvp: true, valueStreamId: true, artId: true },
    });
    if (!epic) return err({ kind: "not_found" as const, resourceType: "Initiative", id: input.epicId });

    const data = {
      kind: "epic",
      title: epic.title,
      ask: epic.costToMvp ?? 0,
      valueStreamId: epic.valueStreamId,
      artId: epic.artId,
      updatedBy: mctx.actorId,
    };
    const row = await tx.budgetCandidate.upsert({
      where: { roundId_epicId: { roundId: input.roundId, epicId: input.epicId } },
      update: data,
      create: {
        ...data,
        tenantId: mctx.tenantId,
        roundId: input.roundId,
        epicId: input.epicId,
        createdBy: mctx.actorId,
      },
      select: { id: true },
    });

    return ok({
      result: { id: row.id },
      audit: {
        action: "budget.candidate.curated" as const,
        resourceType: "budget_candidate" as const,
        resourceId: row.id,
        changes: { epicId: { before: null, after: input.epicId } },
      },
    });
  });
}

/** Entfernt einen Kandidaten aus dem Ballot dieser Kachel (nur in `draft`). */
export async function removeCandidate(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const row = await tx.budgetCandidate.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { id: true, round: { select: { status: true } } },
    });
    if (!row) return err({ kind: "not_found" as const, resourceType: "BudgetCandidate", id: input.id });
    if (row.round.status !== "draft") {
      return err({ kind: "conflict" as const, reason: "Der Ballot ist nur im Status draft kuratierbar." });
    }
    await tx.budgetCandidate.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "budget.candidate.removed" as const,
        resourceType: "budget_candidate" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}
