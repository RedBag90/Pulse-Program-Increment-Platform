/**
 * Participatory-Budgeting-Runde — Lebenszyklus + Rahmen (Spec P2).
 *
 * Eine Runde je Halbjahres-Cycle (`@@unique(tenantId, cycleKey)`). Rahmen (Topf,
 * Entscheider, Termin) wird in `draft` gesetzt; `startRound` (draft→running)
 * erzwingt Topf > 0 und ≥3 Gruppen. Weitere Übergänge folgen in P4/P5.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { canTransitionRound, type RoundStatus } from "@/modules/budgeting/domain/round-status";
import { MIN_GROUPS } from "@/modules/budgeting/domain/group-cut";
import { carryReserveForward } from "@/modules/budgeting/domain/reserve";

/**
 * Reserve beim Schließen: verteilbares Budget (Topf − Pflichtvorhaben) minus die
 * Summe der **finanzierten** Ballot-Epics. Finanziert = Konsens (alle Gruppen Ja)
 * ∪ Streuzonen-Entscheidung `funded`.
 */
async function computeCloseOutcome(
  tx: Prisma.TransactionClient,
  tenantId: string,
  roundId: string,
  poolTotal: number,
): Promise<{ reserve: number; unstageIds: string[] }> {
  const [ballot, votes, decisions, mandatory, groupCount] = await Promise.all([
    tx.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, stagedForBudgeting: true, mandatory: false },
      select: { id: true, costToMvp: true },
    }),
    tx.groupAllocation.findMany({ where: { roundId, funded: true }, select: { epicId: true } }),
    tx.budgetDecision.findMany({ where: { roundId }, select: { epicId: true, outcome: true } }),
    tx.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, mandatory: true },
      select: { costToMvp: true },
    }),
    tx.budgetGroup.count({ where: { roundId } }),
  ]);

  const yesByEpic = new Map<string, number>();
  for (const v of votes) yesByEpic.set(v.epicId, (yesByEpic.get(v.epicId) ?? 0) + 1);
  const decisionByEpic = new Map(decisions.map((d) => [d.epicId, d.outcome]));

  let fundedSum = 0;
  const unstageIds: string[] = [];
  for (const e of ballot) {
    const yes = yesByEpic.get(e.id) ?? 0;
    const consensus = groupCount > 0 && yes === groupCount;
    const funded = consensus || decisionByEpic.get(e.id) === "funded";
    if (funded) fundedSum += e.costToMvp ? Number(e.costToMvp) : 0;
    else unstageIds.push(e.id);
  }

  const mandatorySum = mandatory.reduce((s, e) => s + (e.costToMvp ? Number(e.costToMvp) : 0), 0);
  return { reserve: poolTotal - mandatorySum - fundedSum, unstageIds };
}

export interface CreateRoundInput {
  cycleKey: string;
  poolTotal: number;
  decisionAuthorityIds: string[];
  plannedAt?: Date | null | undefined;
}

/** Legt eine Runde (Status `draft`) für den Cycle an. */
export async function createRound(
  ctx: RequestContext,
  input: CreateRoundInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { cycleKey, poolTotal, decisionAuthorityIds, plannedAt } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.budgetRound.findUnique({
      where: { tenantId_cycleKey: { tenantId: mctx.tenantId, cycleKey } },
      select: { id: true },
    });
    if (existing) {
      return err({ kind: "conflict" as const, reason: `Für ${cycleKey} existiert bereits eine Runde.` });
    }

    // Reserve-Übertrag: die Reserve der zuletzt abgeschlossenen Runde wandert
    // additiv in den Topf (F-03, nur der Betrag).
    const prev = await tx.budgetRound.findFirst({
      where: { tenantId: mctx.tenantId, status: "closed" },
      orderBy: { cycleKey: "desc" },
      select: { reserveAmount: true },
    });
    const carried = prev?.reserveAmount ? Number(prev.reserveAmount) : 0;
    const effectivePool = carryReserveForward(poolTotal, carried);

    const round = await tx.budgetRound.create({
      data: {
        tenantId: mctx.tenantId,
        cycleKey,
        poolTotal: effectivePool,
        status: "draft",
        decisionAuthorityIds,
        plannedAt: plannedAt ?? null,
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
      },
      select: { id: true },
    });

    return ok({
      result: { id: round.id },
      audit: {
        action: "budget.round.created" as const,
        resourceType: "budget_round" as const,
        resourceId: round.id,
        changes: { cycleKey: { before: null, after: cycleKey } },
      },
    });
  });
}

export interface UpdateRoundFrameInput {
  id: string;
  poolTotal?: number | undefined;
  decisionAuthorityIds?: string[] | undefined;
  plannedAt?: Date | null | undefined;
}

/** Aktualisiert den Rahmen einer `draft`-Runde (Topf, Entscheider, Termin). */
export async function updateRoundFrame(
  ctx: RequestContext,
  input: UpdateRoundFrameInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, poolTotal, decisionAuthorityIds, plannedAt } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id });
    if (round.status !== "draft") {
      return err({ kind: "conflict" as const, reason: "Rahmen ist nur im Status draft änderbar." });
    }

    await tx.budgetRound.update({
      where: { id },
      data: {
        ...(poolTotal !== undefined && { poolTotal }),
        ...(decisionAuthorityIds !== undefined && { decisionAuthorityIds }),
        ...(plannedAt !== undefined && { plannedAt }),
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.round.created" as const,
        resourceType: "budget_round" as const,
        resourceId: id,
        changes: {},
      },
    });
  });
}

/**
 * Übergang der Status-Maschine. `draft→running` erzwingt Topf > 0 und ≥3 Gruppen;
 * weitere Guards (Erfassung vollständig / Streuzone entschieden) folgen in P4/P5.
 */
export async function transitionRound(
  ctx: RequestContext,
  input: { id: string; to: RoundStatus },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, to } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id });

    if (!canTransitionRound(round.status as RoundStatus, to)) {
      return err({
        kind: "conflict" as const,
        reason: `Übergang ${round.status} → ${to} ist nicht erlaubt.`,
      });
    }

    if (to === "running") {
      if (Number(round.poolTotal) <= 0) {
        return err({ kind: "conflict" as const, reason: "Topf muss > 0 sein, bevor die Runde startet." });
      }
      const groups = await tx.budgetGroup.count({ where: { roundId: id } });
      if (groups < MIN_GROUPS) {
        return err({
          kind: "conflict" as const,
          reason: `Mindestens ${MIN_GROUPS} Gruppen nötig, bevor die Runde startet (aktuell ${groups}).`,
        });
      }
    }

    const action =
      to === "running"
        ? ("budget.round.started" as const)
        : to === "decided"
          ? ("budget.round.decided" as const)
          : ("budget.round.closed" as const);

    // Beim Schließen: Reserve berechnen + Übergabe ans Detail-Board (F4.3/F5.2).
    // Nicht finanzierte Ballot-Epics werden aus dem €/ART-Board genommen
    // (`stagedForBudgeting=false`); finanzierte bleiben für die Detailplanung.
    let reserveAmount: number | undefined;
    if (to === "closed") {
      const outcome = await computeCloseOutcome(tx, mctx.tenantId, id, Number(round.poolTotal));
      reserveAmount = outcome.reserve;
      if (outcome.unstageIds.length > 0) {
        await tx.initiative.updateMany({
          where: { tenantId: mctx.tenantId, id: { in: outcome.unstageIds } },
          data: { stagedForBudgeting: false },
        });
      }
    }

    await tx.budgetRound.update({
      where: { id },
      data: {
        status: to,
        ...(reserveAmount !== undefined && { reserveAmount }),
        updatedBy: mctx.actorId,
      },
    });

    return ok({
      result: undefined,
      audit: {
        action,
        resourceType: "budget_round" as const,
        resourceId: id,
        changes: { status: { before: round.status, after: to } },
      },
    });
  });
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function getRound(db: PrismaClient, tenantId: string, id: string) {
  return db.budgetRound.findFirst({
    where: { id, tenantId },
    include: {
      groups: { include: { members: true }, orderBy: { name: "asc" } },
    },
  });
}

export function getRoundForCycle(db: PrismaClient, tenantId: string, cycleKey: string) {
  return db.budgetRound.findUnique({
    where: { tenantId_cycleKey: { tenantId, cycleKey } },
    include: { groups: { include: { members: true }, orderBy: { name: "asc" } } },
  });
}

export function listRounds(db: PrismaClient, tenantId: string) {
  return db.budgetRound.findMany({
    where: { tenantId },
    orderBy: { cycleKey: "desc" },
    select: { id: true, cycleKey: true, status: true, poolTotal: true, plannedAt: true },
  });
}
