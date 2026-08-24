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
import { canTransitionRound, type RoundStatus } from "@/modules/budgeting/domain/round-status";
import { carryReserveForward } from "@/modules/budgeting/domain/reserve";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";
import { materializeRtbCandidates } from "@/modules/budgeting/server/services/candidate-service";
import { halfYearKey } from "@/modules/core/kernel/domain/calendar";

/**
 * Reserve beim Schließen: verteilbares Budget (Topf − Pflichtvorhaben) minus die
 * Summe der **finanzierten** Ballot-Epics. Finanziert = Konsens (alle Gruppen Ja)
 * ∪ Streuzonen-Entscheidung `funded`.
 */
interface CloseOutcome {
  reserve: number;
  unstageIds: string[];
  /** Finanzierte Ballot-Epics — Grundlage der €/ART-Vorbefüllung (F-B5). */
  fundedEpics: { id: string; cost: number }[];
}

async function computeCloseOutcome(
  tx: Prisma.TransactionClient,
  tenantId: string,
  roundId: string,
  poolTotal: number,
): Promise<CloseOutcome> {
  const [{ ballot, mandatorySum }, votes, decisions, groupCount] = await Promise.all([
    loadRoundBallot(tx, tenantId),
    tx.groupAllocation.findMany({ where: { roundId, funded: true }, select: { epicId: true } }),
    tx.budgetDecision.findMany({ where: { roundId }, select: { epicId: true, outcome: true } }),
    tx.budgetGroup.count({ where: { roundId } }),
  ]);

  const yesByEpic = new Map<string, number>();
  for (const v of votes) {
    if (!v.epicId) continue; // Legacy-Zeilen tragen epicId; Kachel-Zeilen (candidateId) ignorieren
    yesByEpic.set(v.epicId, (yesByEpic.get(v.epicId) ?? 0) + 1);
  }
  const decisionByEpic = new Map(decisions.map((d) => [d.epicId, d.outcome]));

  let fundedSum = 0;
  const unstageIds: string[] = [];
  const fundedEpics: { id: string; cost: number }[] = [];
  for (const e of ballot) {
    const yes = yesByEpic.get(e.id) ?? 0;
    const consensus = groupCount > 0 && yes === groupCount;
    const funded = consensus || decisionByEpic.get(e.id) === "funded";
    if (funded) {
      fundedSum += e.cost;
      fundedEpics.push({ id: e.id, cost: e.cost });
    } else {
      unstageIds.push(e.id);
    }
  }

  return { reserve: poolTotal - mandatorySum - fundedSum, unstageIds, fundedEpics };
}

export interface CreateRoundInput {
  cycleKey: string;
  poolTotal: number;
  decisionAuthorityIds: string[];
  plannedAt?: Date | null | undefined;
  /** Kachel-Modell: Zeitraum + Verteil-Deadline. */
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
  submissionDeadline?: Date | null | undefined;
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
        changes: { cycleKey: { before: null, after: cycleKey } },
      },
    });
  });
}

export interface CreatePeriodInput {
  poolTotal: number;
  /** Start-Termin der Budgeting-Phase (aus dem Ziele-Picker). */
  startDate: Date;
  /** Ende (Default = Start + 6 Monate, vom Aufrufer gesetzt). */
  endDate: Date;
  /** Verteil-Deadline der Gruppen (Default = endDate). */
  submissionDeadline?: Date | null | undefined;
}

/**
 * Legt eine **Kachel** (Budgeting-Zeitraum) an. Dünner Wrapper um `createRound`:
 * leitet den `cycleKey` aus dem Start-Termin ab (das Halbjahr, in das der Start
 * fällt) und setzt Start/Ende/Deadline. Kein `decisionAuthority` mehr (Finance
 * entscheidet direkt). Zukunfts-Starts sind erlaubt.
 */
export function createPeriod(
  ctx: RequestContext,
  input: CreatePeriodInput,
): Promise<Result<{ id: string }>> {
  return createRound(ctx, {
    cycleKey: halfYearKey(input.startDate),
    poolTotal: input.poolTotal,
    decisionAuthorityIds: [],
    startDate: input.startDate,
    endDate: input.endDate,
    submissionDeadline: input.submissionDeadline ?? input.endDate,
  });
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
    if (!round) return err({ kind: "not_found" as const, resourceType: "BudgetRound", id: input.id });
    if (round.status !== "draft") {
      return err({ kind: "conflict" as const, reason: "Nur eine Kachel im Entwurf lässt sich starten." });
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
        ...(input.submissionDeadline !== undefined && { submissionDeadline: input.submissionDeadline }),
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

    // Topf > 0 und ≥3 Gruppen sind bewusst **keine harte Voraussetzung** — sie
    // erscheinen als Hinweis/Warnung in der UI (PB-Philosophie: beraten, nicht
    // blockieren). Nur die Status-Reihenfolge (oben) ist zwingend.

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

      // Seam schließen (F-B5): finanziert = budgetiert. Jedes finanzierte Epic
      // bekommt eine €/ART-Detailplanung mit `costToMvp` als Startwert für diesen
      // Cycle — aber nur neu angelegt, eine bereits bestehende (manuell gepflegte)
      // Allokation wird NICHT überschrieben (`update: {}` = no-op bei Existenz).
      for (const e of outcome.fundedEpics) {
        await tx.budgetAllocation.upsert({
          where: { epicId: e.id },
          update: {},
          create: {
            tenantId: mctx.tenantId,
            epicId: e.id,
            priority: 0,
            allocations: { [round.cycleKey]: e.cost } as unknown as Prisma.InputJsonValue,
            createdBy: mctx.actorId,
            updatedBy: mctx.actorId,
          },
        });
      }

      // Topf-Vererbung (F-C2): der Runden-Topf (inkl. Reserve-Übertrag) wird der
      // Detailplanungs-Topf dieses Cycles. Merge ins bestehende JSON, nur der
      // Cycle-Key wird gesetzt — andere Perioden bleiben unberührt.
      const tenant = await tx.tenant.findUnique({
        where: { id: mctx.tenantId },
        select: { budgetPoolByPeriod: true },
      });
      const pool = parsePeriodAmountMap(tenant?.budgetPoolByPeriod);
      await tx.tenant.update({
        where: { id: mctx.tenantId },
        data: {
          budgetPoolByPeriod: {
            ...pool,
            [round.cycleKey]: Number(round.poolTotal),
          } as unknown as Prisma.InputJsonValue,
        },
      });
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
  // Kachel-Modell: mehrere Runden je Cycle möglich → findFirst (deterministisch
  // die zuletzt angelegte), kein Unique mehr.
  return db.budgetRound.findFirst({
    where: { tenantId, cycleKey },
    orderBy: { createdAt: "desc" },
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
