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
import { carryReserveForward, pickCarriedReserve } from "@/modules/budgeting/domain/reserve";
import { materializeRtbCandidates } from "@/modules/budgeting/server/services/candidate-service";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";

export interface CreateRoundInput {
  cycleKey: string;
  poolTotal: number;
  decisionAuthorityIds: string[];
  plannedAt?: Date | null | undefined;
  /** Kachel-Modell: Zeitraum + Verteil-Deadline. */
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
  submissionDeadline?: Date | null | undefined;
  /**
   * Reserve der zeitlich vorherigen abgeschlossenen Kachel auf den Topf addieren.
   * Default `true` (bisheriges Verhalten); die Kachel-UI macht es abwählbar.
   */
  carryReserve?: boolean | undefined;
}

/** Legt eine Runde (Status `draft`) für den Cycle an. */
export async function createRound(
  ctx: RequestContext,
  input: CreateRoundInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { cycleKey, poolTotal, decisionAuthorityIds, plannedAt } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    // Kachel-Modell: mehrere/zukünftige Kacheln je Cycle sind erlaubt → kein
    // harter Duplikat-Guard mehr (Überschneidung wird in der UI als weiche
    // Warnung angezeigt).

    // Reserve-Übertrag: die Reserve der **zeitlich vorherigen** abgeschlossenen
    // Kachel wandert additiv in den Topf (F-03, nur der Betrag). Die Auswahl
    // trifft `pickCarriedReserve` — seit dem Kachel-Modell koexistieren mehrere
    // Kacheln je Cycle, ein `orderBy cycleKey desc` zog hier die Reserve einer
    // späteren Kachel in eine frühere.
    const carry = input.carryReserve !== false;
    const closed = carry
      ? await tx.budgetRound.findMany({
          where: { tenantId: mctx.tenantId, status: "closed" },
          select: { cycleKey: true, startDate: true, reserveAmount: true },
        })
      : [];
    const picked = carry
      ? pickCarriedReserve(
          closed.map((r) => ({
            cycleKey: r.cycleKey,
            startDate: r.startDate,
            reserveAmount: r.reserveAmount ? Number(r.reserveAmount) : 0,
          })),
          input.startDate ?? null,
        )
      : null;
    const effectivePool = carryReserveForward(poolTotal, picked?.amount ?? 0);

    const round = await tx.budgetRound.create({
      data: {
        tenantId: mctx.tenantId,
        cycleKey,
        poolTotal: effectivePool,
        status: "draft",
        decisionAuthorityIds,
        plannedAt: plannedAt ?? null,
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
        ...(input.submissionDeadline !== undefined && {
          submissionDeadline: input.submissionDeadline,
        }),
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
        changes: {
          cycleKey: { before: null, after: cycleKey },
          ...(picked && {
            carriedReserve: {
              before: null,
              after: { from: picked.fromCycleKey, amount: picked.amount },
            },
          }),
        },
      },
    });
  });
}

/**
 * Kopiert das Setup einer Runde in eine neue Kachel: **Beteiligte** + **Gruppen**
 * (inkl. Sprecher/Mitglieder) + die kuratierten **Epic-Kandidaten** (PB-Liste).
 * RtB-Kandidaten werden NICHT kopiert (sie materialisieren beim Start).
 * Genutzt von `createPeriod` (Übernahme beim Anlegen) und `startNextPeriod`.
 */
export async function copyPeriodSetup(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fromRoundId: string,
  toRoundId: string,
  actorId: string,
): Promise<void> {
  const [participants, groups, epicCandidates] = await Promise.all([
    tx.budgetParticipant.findMany({ where: { roundId: fromRoundId }, select: { userId: true } }),
    tx.budgetGroup.findMany({
      where: { roundId: fromRoundId },
      select: {
        name: true,
        spokespersonId: true,
        members: { select: { userId: true, team: true, isSubmitter: true, seniority: true } },
      },
    }),
    tx.budgetCandidate.findMany({
      where: { roundId: fromRoundId, kind: "epic" },
      select: { epicId: true, title: true, ask: true, valueStreamId: true, artId: true },
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

  if (epicCandidates.length > 0) {
    await tx.budgetCandidate.createMany({
      data: epicCandidates.map((c) => ({
        tenantId,
        roundId: toRoundId,
        kind: "epic",
        epicId: c.epicId,
        title: c.title,
        ask: c.ask,
        valueStreamId: c.valueStreamId,
        artId: c.artId,
        finalAmount: null,
        createdBy: actorId,
        updatedBy: actorId,
      })),
      skipDuplicates: true,
    });
  }
}

export interface CreatePeriodInput {
  poolTotal: number;
  /** Start-Termin der Budgeting-Phase (aus dem Ziele-Picker). */
  startDate: Date;
  /** Ende (Default = Start + 6 Monate, vom Aufrufer gesetzt). */
  endDate: Date;
  /** Verteil-Deadline der Gruppen (Default = endDate). */
  submissionDeadline?: Date | null | undefined;
  /** Beteiligte + Gruppen + PB-Liste von der jüngsten vorherigen Kachel übernehmen. */
  carryOver?: boolean | undefined;
  /** Reserve der zeitlich vorherigen abgeschlossenen Kachel auf den Topf addieren. */
  carryReserve?: boolean | undefined;
}

/**
 * Legt eine **Kachel** (Budgeting-Zeitraum) an. Dünner Wrapper um `createRound`:
 * leitet den `cycleKey` aus dem Start-Termin ab (das Halbjahr, in das der Start
 * fällt) und setzt Start/Ende/Deadline. Kein `decisionAuthority` mehr (Finance
 * entscheidet direkt). Zukunfts-Starts sind erlaubt.
 */
export async function createPeriod(
  ctx: RequestContext,
  input: CreatePeriodInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);

  // Jüngste vorherige Kachel (für die Übernahme) VOR dem Anlegen bestimmen.
  const previous = input.carryOver
    ? await ctx.db.budgetRound.findFirst({
        where: { tenantId: mctx.tenantId },
        orderBy: { startDate: "desc" },
        select: { id: true },
      })
    : null;

  const created = await createRound(ctx, {
    cycleKey: halfYearKey(input.startDate),
    poolTotal: input.poolTotal,
    decisionAuthorityIds: [],
    startDate: input.startDate,
    endDate: input.endDate,
    submissionDeadline: input.submissionDeadline ?? input.endDate,
    carryReserve: input.carryReserve,
  });
  if (!created.ok || !previous) return created;

  const newId = created.value.id;
  const copy = await withAuditedTransaction(mctx, async (tx) => {
    await copyPeriodSetup(tx, mctx.tenantId, previous.id, newId, mctx.actorId);
    return ok({
      result: { id: newId },
      audit: {
        action: "budget.round.created" as const,
        resourceType: "budget_round" as const,
        resourceId: newId,
        changes: { copiedFrom: { before: null, after: previous.id } },
      },
    });
  });
  if (!copy.ok) return copy;

  return ok({ id: newId });
}

/**
 * Startet eine Kachel (draft→running): materialisiert die **RtB**-Kandidaten aus
 * den aktiven Positionen aller VS (Epic-Kandidaten stammen aus der Kuratierung)
 * und friert den Kandidatensatz ein. Ab hier verteilen die Gruppen.
 */
export async function startPeriod(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { status: true },
    });
    if (!round)
      return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.id });
    if (round.status !== "draft") {
      return err({
        kind: "conflict" as const,
        reason: "Nur eine Kachel im Entwurf lässt sich starten.",
      });
    }

    await materializeRtbCandidates(tx, mctx.tenantId, input.id, mctx.actorId);
    await tx.budgetRound.update({
      where: { id: input.id },
      data: { status: "running", updatedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "budget.round.started" as const,
        resourceType: "budget_round" as const,
        resourceId: input.id,
        changes: { status: { before: "draft", after: "running" } },
      },
    });
  });
}

export interface UpdateRoundFrameInput {
  id: string;
  poolTotal?: number | undefined;
  decisionAuthorityIds?: string[] | undefined;
  plannedAt?: Date | null | undefined;
  submissionDeadline?: Date | null | undefined;
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
}

/** Aktualisiert den Rahmen einer `draft`-Runde (Topf, Zeitraum, Deadline). */
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
        ...(input.submissionDeadline !== undefined && {
          submissionDeadline: input.submissionDeadline,
        }),
        ...(input.startDate !== undefined && { startDate: input.startDate }),
        ...(input.endDate !== undefined && { endDate: input.endDate }),
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

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Löscht eine Kachel (Runde) samt Subtree (Gruppen/Mitglieder/Allocations,
 * Kandidaten, Beteiligte, Decisions, Report-outs — alle `onDelete: Cascade`).
 * App-weite Epic-Budgets (`BudgetAllocation`) bleiben (epic-keyed, nicht an die
 * Runde gekoppelt). Gate: `budget.round.manage` (Action-Layer).
 */
export async function deletePeriod(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const round = await tx.budgetRound.findFirst({
      where: { id: input.id, tenantId: mctx.tenantId },
      select: { id: true },
    });
    if (!round)
      return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.id });

    await tx.budgetRound.delete({ where: { id: input.id } });

    return ok({
      result: undefined,
      audit: {
        action: "budget.round.deleted" as const,
        resourceType: "budget_round" as const,
        resourceId: input.id,
        changes: {},
      },
    });
  });
}

export function getRound(db: PrismaClient, tenantId: string, id: string) {
  return db.budgetRound.findFirst({
    where: { id, tenantId },
    include: {
      groups: { include: { members: true }, orderBy: { name: "asc" } },
    },
  });
}

export function getRoundForCycle(db: PrismaClient, tenantId: string, cycleKey: string) {
  // Kachel-Modell: mehrere Runden je Cycle möglich → findFirst (deterministisch
  // die zuletzt angelegte), kein Unique mehr.
  return db.budgetRound.findFirst({
    where: { tenantId, cycleKey },
    orderBy: { createdAt: "desc" },
    include: { groups: { include: { members: true }, orderBy: { name: "asc" } } },
  });
}
