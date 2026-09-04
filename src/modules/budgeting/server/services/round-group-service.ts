/**
 * Gruppen & Mitglieder einer PB-Runde (Spec P2, F2.3).
 *
 * Struktur-Edits (Gruppe/Mitglied anlegen/entfernen) nur solange die Runde
 * `draft` ist — ab `running` ist der Schnitt eingefroren. Das Pre-Read-Häkchen
 * (`hasRead`, C-05) bleibt auch in `running` setzbar.
 */

import type { Prisma } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";

/** Lädt die Runde eines Group-/Member-Kontexts (Tenant-Scope + Status). */
async function roundOfGroup(
  tx: Prisma.TransactionClient,
  tenantId: string,
  groupId: string,
): Promise<{ roundId: string; status: string } | null> {
  const g = await tx.budgetGroup.findFirst({
    where: { id: groupId, round: { tenantId } },
    select: { roundId: true, round: { select: { status: true } } },
  });
  return g ? { roundId: g.roundId, status: g.round.status } : null;
}

export async function addGroup(
  ctx: RequestContext,
  input: { roundId: string; name: string; spokespersonId?: string | null | undefined },
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
        reason: "Gruppen sind nur im Status draft änderbar.",
      });
    }
    const group = await tx.budgetGroup.create({
      data: {
        roundId: input.roundId,
        name: input.name,
        spokespersonId: input.spokespersonId ?? null,
      },
      select: { id: true },
    });
    return ok({
      result: { id: group.id },
      audit: {
        action: "budget.group.created" as const,
        resourceType: "budget_group" as const,
        resourceId: group.id,
        changes: { name: { before: null, after: input.name } },
      },
    });
  });
}

export async function updateGroup(
  ctx: RequestContext,
  input: { id: string; name?: string | undefined; spokespersonId?: string | null | undefined },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const ctxRound = await roundOfGroup(tx, mctx.tenantId, input.id);
    if (!ctxRound)
      return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.id });
    if (ctxRound.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Gruppen sind nur im Status draft änderbar.",
      });
    }
    await tx.budgetGroup.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.spokespersonId !== undefined && { spokespersonId: input.spokespersonId }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "budget.group.updated" as const,
        resourceType: "budget_group" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}

export async function removeGroup(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const ctxRound = await roundOfGroup(tx, mctx.tenantId, input.id);
    if (!ctxRound)
      return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.id });
    if (ctxRound.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Gruppen sind nur im Status draft änderbar.",
      });
    }
    await tx.budgetGroup.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "budget.group.deleted" as const,
        resourceType: "budget_group" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}

export async function addGroupMember(
  ctx: RequestContext,
  input: {
    groupId: string;
    userId: string;
    team?: string | null | undefined;
    isSubmitter?: boolean | undefined;
    seniority?: string | null | undefined;
  },
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const ctxRound = await roundOfGroup(tx, mctx.tenantId, input.groupId);
    if (!ctxRound)
      return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.groupId });
    if (ctxRound.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Mitglieder sind nur im Status draft änderbar.",
      });
    }
    const member = await tx.budgetGroupMember.create({
      data: {
        groupId: input.groupId,
        userId: input.userId,
        team: input.team ?? null,
        isSubmitter: input.isSubmitter ?? false,
        seniority: input.seniority ?? null,
      },
      select: { id: true },
    });
    return ok({
      result: { id: member.id },
      audit: {
        action: "budget.group.updated" as const,
        resourceType: "budget_group" as const,
        resourceId: input.groupId,
        changes: { member: { before: null, after: input.userId } },
      },
    });
  });
}

export async function removeGroupMember(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const member = await tx.budgetGroupMember.findFirst({
      where: { id: input.id, group: { round: { tenantId: mctx.tenantId } } },
      select: { groupId: true, group: { select: { round: { select: { status: true } } } } },
    });
    if (!member)
      return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.id });
    if (member.group.round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Mitglieder sind nur im Status draft änderbar.",
      });
    }
    await tx.budgetGroupMember.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "budget.group.updated" as const,
        resourceType: "budget_group" as const,
        resourceId: member.groupId,
        changes: {},
      },
    });
  });
}

/** Pre-Read-Häkchen (C-05) — auch in `running` setzbar. */
export async function setMemberRead(
  ctx: RequestContext,
  input: { id: string; hasRead: boolean },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const member = await tx.budgetGroupMember.findFirst({
      where: { id: input.id, group: { round: { tenantId: mctx.tenantId } } },
      select: { groupId: true },
    });
    if (!member)
      return err({ kind: "not_found" as const, resourceType: "BudgetGroup", id: input.id });
    await tx.budgetGroupMember.update({
      where: { id: input.id },
      data: { hasRead: input.hasRead },
    });
    return ok({
      result: undefined,
      audit: {
        action: "budget.group.updated" as const,
        resourceType: "budget_group" as const,
        resourceId: member.groupId,
        changes: { hasRead: { before: null, after: input.hasRead } },
      },
    });
  });
}
