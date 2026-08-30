import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { ok, err, isErr, type Result } from "@/modules/core/kernel/domain/errors";
import {
  toMutationContext,
  withAuditedTransaction,
  onUniqueConstraint,
  type MutationContext,
} from "@/modules/core/kernel/server/mutation";
import { effectivePractices } from "@/modules/core/kernel/domain/operating-model";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
} from "@/modules/work/domain/benefit-hypothesis";
import { parseBusinessCase, businessCaseHasContent } from "@/modules/work/domain/business-case";
import {
  type ApprovalDecision,
  type ApprovalStatus,
  type Quorum,
  decisionStatus,
  isQuorum,
  assertAssignedApprover,
} from "@/modules/work/domain/approval-primitives";
import { type EpicGateFacts, gateReadiness } from "@/modules/work/domain/gate-readiness";
import { type GateStep } from "@/modules/work/domain/stage-gate";
import { withImplementationActual } from "@/modules/work/domain/timeline";
import { isoDay } from "@/modules/core/kernel/domain/calendar";
import {
  type GatePolicy,
  type ResolvedApprover,
  type ApproverOverride,
  type GateApproverRuleRow,
  resolveGatePolicy,
  expandApprovers,
  isGateApproverRole,
} from "@/modules/work/domain/gate-policy";
import {
  planGateRequest,
  decideGateTransitionOutcome,
  planGateRevert,
  type GateStamps,
  type GateTransitionStatus,
} from "@/modules/work/domain/gate-transition";
import { loadAuthorizedEpic } from "@/modules/work/server/services/epic-access";

// ---------------------------------------------------------------------------
// Reifegrad-Wechsel — der impure Rand um die reine Gate-Logik.
//
// Ersetzt `stage-gate-engine.ts`. Gleiche Blatt-Disziplin: importiert nur reines
// Domain, Kernel, Prisma und den Audit-Sink — nie `epic.ts`, `feature.ts`,
// `epic-approval.ts` oder `budgeting.ts`. Der Unterschied zum Vorgänger ist,
// dass es keine Fire-and-Forget-Schreiber mehr gibt: jeder Vorgang hier ist
// eine benannte Nutzerhandlung mit genau einer Audit-Zeile. Damit entfällt der
// alte `emitAudit: false`-Kunstgriff, mit dem sich zwei Schreiber eine
// Audit-Zeile teilen mussten.
// ---------------------------------------------------------------------------

/** Summiert das persistierte Perioden-Budget-JSON (`{ "YYYY-H1": n, … }`). */
function sumAllocations(allocations: Prisma.JsonValue | null | undefined): number {
  if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) return 0;
  return Object.values(allocations as Record<string, unknown>).reduce<number>(
    (sum, v) => sum + (typeof v === "number" && Number.isFinite(v) ? v : 0),
    0,
  );
}

/** Lädt die Practice-Flags des aktiven Zielbilds. */
async function loadPractices(tx: Prisma.TransactionClient, tenantId: string) {
  const model = await tx.targetOperatingModel.findFirst({
    where: { tenantId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  return effectivePractices(model);
}

/**
 * Materialisiert in einem Durchlauf alles, was die reine Logik über ein Epic
 * wissen muss: die Zeile, die Child-Feature-Hochrechnung, die Budget-Summe und
 * die `multiPartyApproval`-Practice. `null`, wenn es das Epic nicht gibt.
 *
 * Das ist das frühere `loadEpicGateState` — ohne `actorId` (Readiness kennt
 * keinen Handelnden) und ohne `proposedStageGate` (es gibt keinen Slot mehr).
 */
export async function loadEpicGateFacts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  epicId: string,
): Promise<EpicGateFacts | null> {
  const row = await tx.initiative.findFirst({
    where: { id: epicId, tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    select: {
      stageGate: true,
      ownerId: true,
      hypothesisApprovedAt: true,
      businessCaseApprovedAt: true,
      selectedForDetailingAt: true,
      selectedForAnalyzingAt: true,
      implementationStartedAt: true,
      implementationCompletedAt: true,
      approvedAt: true,
      impactRecognizedAt: true,
      benefitHypothesis: true,
      businessCase: true,
      budgetAllocation: { select: { allocations: true } },
    },
  });
  if (!row) return null;

  const childWhere = {
    parentId: epicId,
    tenantId,
    level: InitiativeLevel.FEATURE,
    deletedAt: null,
  };
  const [total, started, completed, practices] = await Promise.all([
    tx.initiative.count({ where: childWhere }),
    tx.initiative.count({ where: { ...childWhere, status: { in: ["in_progress", "completed"] } } }),
    tx.initiative.count({ where: { ...childWhere, status: "completed" } }),
    loadPractices(tx, tenantId),
  ]);

  return {
    stageGate: row.stageGate as StageGate,
    ownerId: row.ownerId,
    hypothesisApprovedAt: row.hypothesisApprovedAt,
    hasHypothesisContent: benefitHypothesisHasContent(
      parseBenefitHypothesis(row.benefitHypothesis).current,
    ),
    hasBusinessCaseContent: businessCaseHasContent(parseBusinessCase(row.businessCase).current),
    businessCaseApprovedAt: row.businessCaseApprovedAt,
    budgetAllocationSum: sumAllocations(row.budgetAllocation?.allocations),
    childFeatureStats: { total, started, completed },
    selectedForDetailingAt: row.selectedForDetailingAt,
    selectedForAnalyzingAt: row.selectedForAnalyzingAt,
    implementationStartedAt: row.implementationStartedAt,
    implementationCompletedAt: row.implementationCompletedAt,
    approvedAt: row.approvedAt,
    impactRecognizedAt: row.impactRecognizedAt,
    multiPartyApproval: practices.multiPartyApproval,
  };
}

/**
 * Löst die Abnehmer für ein Ziel-Gate auf: zwei Queries, danach entscheidet
 * ausschliesslich reine Logik. Die Wertstrom-Governance-Spalten
 * (`financeApproverId`/`vmoId`) speisen dieselben Platzhalter, die
 * `buildApprovalView` für den Business Case schon nutzt.
 */
export async function resolveGateApprovers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  epic: { valueStreamId: string | null; ownerId: string | null },
  toGate: GateStep,
  override?: readonly ApproverOverride[] | undefined,
  opts?: { multiPartyApproval?: boolean },
): Promise<{ policy: GatePolicy; approvers: ResolvedApprover[] }> {
  const [ruleRows, valueStream] = await Promise.all([
    tx.stageGateApproverRule.findMany({
      where: {
        tenantId,
        toGate,
        // Wertstrom-Zeile UND Tenant-Default holen; welche gewinnt, entscheidet
        // die reine `resolveGatePolicy`. (`in: [id, null]` geht bei einer
        // nullbaren Spalte nicht — Prisma lässt null dort nicht zu.)
        ...(epic.valueStreamId
          ? { OR: [{ valueStreamId: epic.valueStreamId }, { valueStreamId: null }] }
          : { valueStreamId: null }),
      },
      select: {
        valueStreamId: true,
        toGate: true,
        required: true,
        quorum: true,
        approverUserIds: true,
        approverRoles: true,
      },
    }),
    epic.valueStreamId
      ? tx.valueStream.findUnique({
          where: { id: epic.valueStreamId },
          select: { financeApproverId: true, vmoId: true },
        })
      : Promise.resolve(null),
  ]);

  const policy = resolveGatePolicy(toGate, ruleRows as GateApproverRuleRow[], epic.valueStreamId, {
    ...(opts?.multiPartyApproval !== undefined && { multiPartyApproval: opts.multiPartyApproval }),
  });
  const approvers = expandApprovers(
    policy,
    {
      valueStreamFinanceApproverId: valueStream?.financeApproverId ?? null,
      valueStreamVmoId: valueStream?.vmoId ?? null,
      epicOwnerId: epic.ownerId,
    },
    override,
  );
  return { policy, approvers };
}

/** Practice-Gate: ohne Stage-Gates im Zielbild gibt es keine Reifegrad-Wechsel. */
async function requireStageGatePractice(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<Result<void>> {
  const practices = await loadPractices(tx, tenantId);
  if (!practices.stageGates) {
    return err({
      kind: "forbidden" as const,
      reason: "Stage Gates sind im aktiven Zielbild nicht aktiviert",
    });
  }
  return ok(undefined);
}

/** Der Spalten-Patch als Prisma-Update — eine Stelle für den Cast. */
function stampsToUpdate(
  stamps: GateStamps,
  actorId: string,
): Prisma.InitiativeUncheckedUpdateInput {
  return { ...(stamps as Prisma.InitiativeUncheckedUpdateInput), updatedBy: actorId };
}

/**
 * Schreibt einen Stempel-Patch auf die Epic-Zeile — die **eine** Stelle dafür.
 *
 * Sonderfall L4.2: die Bestätigung „Umsetzung fertig" führt zugleich das
 * Ist-Datum im Timeline-JSON (`actuals.implementation`). Das ist die bewusste
 * Ausnahme davon, dass `saveTimeline` der einzige Timeline-Schreiber ist —
 * dieses eine Datum gehört der Abnahme, nicht der freien Pflege. Ein Revert
 * räumt es mit ab (`implementationCompletedAt: null`).
 *
 * Sonderfall L1 und L3.1: diese beiden Abnahmen *sind* die inhaltliche Freigabe
 * von Hypothese bzw. Business Case. Sie ziehen deshalb einen Schnappschuss des
 * freigegebenen Textes in die Baseline-Spalte. Früher tat das `startRevision`;
 * seit es keine Revisionen mehr gibt, ist die Abnahme der einzige Zeitpunkt, an
 * dem feststeht, *was* freigegeben wurde. Der Schnappschuss trägt danach den
 * Review-Diff: wer nach einer Rückstufung neu beantragt, zeigt seinen Abnehmern,
 * was sich gegenüber der letzten Freigabe geändert hat. Ein Revert räumt ihn
 * bewusst **nicht** ab — genau dafür ist er da.
 */
async function applyGateStamps(
  tx: Prisma.TransactionClient,
  epicId: string,
  stamps: GateStamps,
  actorId: string,
  to?: GateStep,
): Promise<void> {
  const data = stampsToUpdate(stamps, actorId);
  const needsTimeline = stamps.implementationCompletedAt !== undefined;
  const needsBaseline = to === "L1" || to === "L3.1";
  if (needsTimeline || needsBaseline) {
    const row = await tx.initiative.findUnique({
      where: { id: epicId },
      select: { timeline: true, benefitHypothesis: true, businessCase: true },
    });
    if (needsTimeline) {
      const iso = stamps.implementationCompletedAt
        ? isoDay(stamps.implementationCompletedAt)
        : null;
      data.timeline = withImplementationActual(
        row?.timeline,
        iso,
      ) as unknown as Prisma.InputJsonValue;
    }
    if (to === "L1" && row?.benefitHypothesis != null) {
      data.baselineBenefitHypothesis = row.benefitHypothesis as Prisma.InputJsonValue;
    }
    if (to === "L3.1" && row?.businessCase != null) {
      data.baselineBusinessCase = row.businessCase as Prisma.InputJsonValue;
    }
  }
  await tx.initiative.update({ where: { id: epicId }, data });
}

// ---------------------------------------------------------------------------
// Antrag
// ---------------------------------------------------------------------------

export interface RequestGateTransitionInput {
  epicId: string;
  toGate: GateStep;
  reason?: string | undefined;
  /**
   * Am Antrag benannte Abnehmer, jeweils mit der Rolle, für die sie zeichnen.
   * Nur wirksam für Schritte, die `allowsAdHocApprovers` freigibt — heute L3.1,
   * wo die fünf Business-Case-Parteien je Epic besetzt werden.
   */
  approvers?: ApproverOverride[] | undefined;
}

export interface RequestGateTransitionResult {
  transitionId: string;
  status: GateTransitionStatus;
  from: GateStep;
  to: GateStep;
  /** Wie viele Personen noch abnehmen müssen — 0 bei sofortigem Vorrücken. */
  pendingApprovers: number;
}

/**
 * Beantragt einen Reifegrad-Wechsel. Legt die Antragszeile plus je eine
 * Abnahme-Zeile pro aufgelöster Person an; das Gate bewegt sich hier **nicht**
 * (Ausnahme: ein Gate ohne Abnahmepflicht rückt in derselben Transaktion vor).
 */
export async function requestGateTransition(
  ctx: RequestContext,
  input: RequestGateTransitionInput,
): Promise<Result<RequestGateTransitionResult>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const practice = await requireStageGatePractice(tx, mctx.tenantId);
      if (isErr(practice)) return practice;

      // ADR-0002: gegen die echte Zeile autorisieren, nicht gegen den Input.
      const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
        id: input.epicId,
        action: "epic.gate.request",
        select: { id: true },
      });
      if (isErr(loaded)) return loaded;

      const facts = await loadEpicGateFacts(tx, mctx.tenantId, input.epicId);
      if (!facts) {
        return err({ kind: "not_found" as const, resourceType: "Epic", id: input.epicId });
      }

      const open = await tx.stageGateTransition.findFirst({
        where: { initiativeId: input.epicId, tenantId: mctx.tenantId, status: "pending" },
        select: { id: true },
      });

      const { policy, approvers } = await resolveGateApprovers(
        tx,
        mctx.tenantId,
        { valueStreamId: loaded.value.valueStreamId, ownerId: loaded.value.ownerId },
        input.toGate,
        input.approvers,
        { multiPartyApproval: facts.multiPartyApproval },
      );

      const plan = planGateRequest({
        facts,
        to: input.toGate,
        policy,
        approvers,
        actorId: mctx.actorId,
        hasOpenRequest: open != null,
        now: new Date(),
      });
      if (isErr(plan)) return plan;
      const { from, to, quorum, immediate, stamps, readiness } = plan.value;

      const now = new Date();
      const row = await tx.stageGateTransition.create({
        data: {
          tenantId: mctx.tenantId,
          initiativeId: input.epicId,
          fromGate: from,
          toGate: to,
          kind: "forward",
          status: immediate ? "approved" : "pending",
          quorum,
          requestedBy: mctx.actorId,
          reason: input.reason ?? null,
          readiness: readiness.criteria as unknown as Prisma.InputJsonValue,
          ...(immediate && { resolvedAt: now, resolvedBy: mctx.actorId }),
          approvals: {
            create: plan.value.approvers.map((a) => ({
              tenantId: mctx.tenantId,
              approverUserId: a.userId,
              role: a.role,
              source: a.source,
              createdBy: mctx.actorId,
            })),
          },
        },
        select: { id: true, status: true },
      });

      if (immediate && stamps) {
        await applyGateStamps(tx, input.epicId, stamps, mctx.actorId, to);
      }

      return ok({
        result: {
          transitionId: row.id,
          status: row.status as GateTransitionStatus,
          from,
          to,
          pendingApprovers: plan.value.approvers.length,
        },
        audit: {
          // Bewusst `initiative` + Epic-ID: `listInitiativeHistory` filtert genau
          // auf dieses Paar, also erscheint der Vorgang ohne Zusatzarbeit in der
          // Epic-Activity-Sidebar.
          action: immediate
            ? ("initiative.stage_gate.advanced" as const)
            : ("initiative.stage_gate.requested" as const),
          resourceType: "initiative" as const,
          resourceId: input.epicId,
          changes: {
            stageGate: { before: from, after: to },
            approvers: {
              before: null,
              after: plan.value.approvers.map((a) => a.userId),
            },
            ...(input.reason ? { comment: { before: null, after: input.reason } } : {}),
          },
        },
      });
    },
    {
      // Der partielle Unique-Index `stage_gate_transitions_one_open` fängt den
      // Fall ab, dass zwei Anträge sich zwischen Lesen und Schreiben überholen.
      onPrismaError: onUniqueConstraint(
        "Für dieses Epic ist bereits ein Reifegrad-Wechsel beantragt.",
      ),
    },
  );
}

// ---------------------------------------------------------------------------
// Entscheidung
// ---------------------------------------------------------------------------

export interface DecideGateTransitionInput {
  transitionId: string;
  decision: ApprovalDecision;
  comment?: string | undefined;
}

export interface DecideGateTransitionResult {
  outcome: "pending" | "advanced" | "rejected";
  from: GateStep;
  to: GateStep;
  remaining: number;
}

/**
 * Ein namentlich benannter Abnehmer entscheidet.
 *
 * Der einzige Gate-Service, der **nicht** über `loadAuthorizedEpic` mit einer
 * Portfolio-Capability geht: der eingefrorene Abnehmer kann ein
 * Finance-Controller ohne Portfolio-Rolle sein. Der Zugriff wird stattdessen
 * über die Abnahme-Zeile selbst hergeleitet — die Zeile *ist* die Berechtigung.
 * `epic.gate.decide` ist dazu nur der grobe Vorfilter in der Action; die
 * maßgebliche Prüfung ist `assertAssignedApprover` (ADR-0002, dieselbe
 * Aufteilung wie `decideApproval` auf der Business-Case-Achse).
 */
export async function decideGateTransition(
  ctx: RequestContext,
  input: DecideGateTransitionInput,
): Promise<Result<DecideGateTransitionResult>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction<DecideGateTransitionResult>(mctx, async (tx) => {
    const practice = await requireStageGatePractice(tx, mctx.tenantId);
    if (isErr(practice)) return practice;

    const row = await tx.stageGateApproval.findFirst({
      where: {
        transitionId: input.transitionId,
        tenantId: mctx.tenantId,
        approverUserId: mctx.actorId,
      },
      select: {
        id: true,
        status: true,
        approverUserId: true,
        transition: {
          select: {
            id: true,
            initiativeId: true,
            fromGate: true,
            toGate: true,
            status: true,
            quorum: true,
          },
        },
      },
    });
    if (!row) {
      return err({
        kind: "not_found" as const,
        resourceType: "Gate-Freigabe",
        id: input.transitionId,
      });
    }

    // Zeilen-Eigentum — dieselbe reine Funktion wie die Business-Case-Achse.
    const assigned = assertAssignedApprover(row, mctx.actorId);
    if (isErr(assigned)) return assigned;

    const transition = row.transition;
    if (transition.status !== "pending") {
      return err({
        kind: "conflict" as const,
        reason: "Dieser Antrag ist bereits entschieden.",
      });
    }
    if (row.status !== "pending") {
      return err({
        kind: "conflict" as const,
        reason: "Du hast diesen Antrag bereits entschieden.",
      });
    }

    const facts = await loadEpicGateFacts(tx, mctx.tenantId, transition.initiativeId);
    if (!facts) {
      return err({
        kind: "not_found" as const,
        resourceType: "Epic",
        id: transition.initiativeId,
      });
    }
    // Das Epic kann seit dem Antrag bewegt worden sein (etwa durch eine
    // Korrektur). Dann deckt der Antrag den aktuellen Zustand nicht mehr.
    if (facts.stageGate !== transition.fromGate) {
      return err({
        kind: "conflict" as const,
        reason: `Der Antrag bezieht sich auf ${transition.fromGate}, das Epic steht inzwischen auf ${facts.stageGate}.`,
      });
    }

    const siblings = await tx.stageGateApproval.findMany({
      where: { transitionId: transition.id, tenantId: mctx.tenantId },
      select: { approverUserId: true, status: true },
    });

    const outcome = decideGateTransitionOutcome({
      facts,
      to: transition.toGate as GateStep,
      quorum: isQuorum(transition.quorum) ? (transition.quorum as Quorum) : "all",
      rows: siblings.map((s) => ({
        approverUserId: s.approverUserId,
        status: s.status as ApprovalStatus,
      })),
      decision: input.decision,
      deciderId: mctx.actorId,
      comment: input.comment,
      now: new Date(),
    });

    const now = new Date();
    await tx.stageGateApproval.update({
      where: { id: row.id },
      data: {
        status: decisionStatus(input.decision),
        decidedAt: now,
        comment: input.comment ?? null,
      },
    });

    const from = transition.fromGate as GateStep;
    const to = transition.toGate as GateStep;

    if (outcome.kind === "advance") {
      await applyGateStamps(tx, transition.initiativeId, outcome.stamps, mctx.actorId, outcome.to);
      await tx.stageGateTransition.update({
        where: { id: transition.id },
        data: { status: "approved", resolvedAt: now, resolvedBy: mctx.actorId },
      });
      return ok({
        result: { outcome: "advanced" as const, from, to, remaining: 0 },
        audit: {
          action: "initiative.stage_gate.advanced" as const,
          resourceType: "initiative" as const,
          resourceId: transition.initiativeId,
          changes: {
            stageGate: { before: from, after: to },
            ...(input.comment ? { comment: { before: null, after: input.comment } } : {}),
          },
        },
      });
    }

    if (outcome.kind === "rejected") {
      await tx.stageGateTransition.update({
        where: { id: transition.id },
        data: { status: "rejected", resolvedAt: now, resolvedBy: mctx.actorId },
      });
      return ok({
        result: { outcome: "rejected" as const, from, to, remaining: 0 },
        audit: {
          action: "initiative.stage_gate.request.rejected" as const,
          resourceType: "initiative" as const,
          resourceId: transition.initiativeId,
          changes: {
            requestedGate: { before: to, after: null },
            ...(input.comment ? { comment: { before: null, after: input.comment } } : {}),
          },
        },
      });
    }

    return ok({
      result: {
        outcome: "pending" as const,
        from,
        to,
        remaining: outcome.remaining,
      },
      audit: {
        action: "initiative.stage_gate.approval.granted" as const,
        resourceType: "initiative" as const,
        resourceId: transition.initiativeId,
        changes: {
          approver: { before: null, after: mctx.actorId },
          ...(input.comment ? { comment: { before: null, after: input.comment } } : {}),
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Zurückziehen
// ---------------------------------------------------------------------------

/**
 * Der Antragsteller (oder das Portfolio) zieht einen offenen Antrag zurück —
 * der Vorgang, den es beim alten Vorschlags-Slot gar nicht gab: ein einmal
 * gesetzter Vorschlag liess sich nicht verwerfen, nur überschreiben.
 */
export async function withdrawGateTransition(
  ctx: RequestContext,
  input: { transitionId: string; reason: string },
): Promise<Result<{ epicId: string; toGate: GateStep }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const transition = await tx.stageGateTransition.findFirst({
      where: { id: input.transitionId, tenantId: mctx.tenantId },
      select: { id: true, initiativeId: true, toGate: true, status: true },
    });
    if (!transition) {
      return err({
        kind: "not_found" as const,
        resourceType: "Gate-Antrag",
        id: input.transitionId,
      });
    }
    if (transition.status !== "pending") {
      return err({
        kind: "conflict" as const,
        reason: "Nur ein offener Antrag kann zurückgezogen werden.",
      });
    }

    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: transition.initiativeId,
      action: "epic.gate.withdraw",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    await tx.stageGateTransition.update({
      where: { id: transition.id },
      data: {
        status: "withdrawn",
        resolvedAt: new Date(),
        resolvedBy: mctx.actorId,
        reason: input.reason,
      },
    });

    return ok({
      result: { epicId: transition.initiativeId, toGate: transition.toGate as GateStep },
      audit: {
        action: "initiative.stage_gate.request.withdrawn" as const,
        resourceType: "initiative" as const,
        resourceId: transition.initiativeId,
        changes: {
          requestedGate: { before: transition.toGate, after: null },
          comment: { before: null, after: input.reason },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Korrektur (rückwärts)
// ---------------------------------------------------------------------------

/**
 * Stuft ein Epic um genau einen Reifegrad zurück und räumt dabei die Stempel des
 * verlassenen Gates ab. Ein offener Vorwärts-Antrag wird mitgezogen: er bezieht
 * sich auf ein Ausgangs-Gate, das es nicht mehr gibt.
 */
export async function revertStageGate(
  ctx: RequestContext,
  input: { epicId: string; toGate: GateStep; reason: string },
): Promise<Result<{ from: GateStep; to: GateStep }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const practice = await requireStageGatePractice(tx, mctx.tenantId);
    if (isErr(practice)) return practice;

    const loaded = await loadAuthorizedEpic(tx, ctx.principal, mctx, {
      id: input.epicId,
      action: "epic.gate.revert",
      select: { id: true },
    });
    if (isErr(loaded)) return loaded;

    const facts = await loadEpicGateFacts(tx, mctx.tenantId, input.epicId);
    if (!facts) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id: input.epicId });
    }

    const plan = planGateRevert({
      facts,
      to: input.toGate,
      reason: input.reason,
      now: new Date(),
    });
    if (isErr(plan)) return plan;

    const now = new Date();
    await applyGateStamps(tx, input.epicId, plan.value.stamps, mctx.actorId);

    // Ein offener Antrag ging von einem Gate aus, auf dem das Epic nicht mehr
    // steht — er würde sonst als Karteileiche auf die Abnehmer warten.
    await tx.stageGateTransition.updateMany({
      where: { initiativeId: input.epicId, tenantId: mctx.tenantId, status: "pending" },
      data: {
        status: "withdrawn",
        resolvedAt: now,
        resolvedBy: mctx.actorId,
        reason: "Automatisch zurückgezogen: das Epic wurde zurückgestuft.",
      },
    });

    await tx.stageGateTransition.create({
      data: {
        tenantId: mctx.tenantId,
        initiativeId: input.epicId,
        fromGate: plan.value.from,
        toGate: plan.value.to,
        kind: "revert",
        status: "approved",
        quorum: "all",
        requestedBy: mctx.actorId,
        reason: input.reason,
        resolvedAt: now,
        resolvedBy: mctx.actorId,
      },
    });

    return ok({
      result: { from: plan.value.from, to: plan.value.to },
      audit: {
        action: "initiative.stage_gate.reverted" as const,
        resourceType: "initiative" as const,
        resourceId: input.epicId,
        changes: {
          stageGate: { before: plan.value.from, after: plan.value.to },
          comment: { before: null, after: input.reason },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Abnehmer-Regeln konfigurieren
// ---------------------------------------------------------------------------

export interface SaveGateApproverRuleInput {
  /** `null` = Tenant-Default. */
  valueStreamId: string | null;
  toGate: GateStep;
  required: boolean;
  quorum: Quorum;
  approverUserIds: string[];
  approverRoles: string[];
}

export async function saveGateApproverRule(
  ctx: RequestContext,
  input: SaveGateApproverRuleInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const roles = input.approverRoles.filter(isGateApproverRole);

    const previous = await tx.stageGateApproverRule.findFirst({
      where: {
        tenantId: mctx.tenantId,
        valueStreamId: input.valueStreamId,
        toGate: input.toGate,
      },
      select: { id: true, approverUserIds: true, approverRoles: true, required: true },
    });

    // Kein `upsert`: der Compound-Unique enthält die nullbare `valueStreamId`,
    // und Prisma lässt null in einem `where`-Compound nicht zu. Der
    // findFirst-oben-drüber gibt uns die Vorher-Werte fürs Audit ohnehin schon.
    const data = {
      required: input.required,
      quorum: input.quorum,
      approverUserIds: input.approverUserIds,
      approverRoles: roles,
      updatedBy: mctx.actorId,
    };
    const row = previous
      ? await tx.stageGateApproverRule.update({
          where: { id: previous.id },
          data,
          select: { id: true },
        })
      : await tx.stageGateApproverRule.create({
          data: {
            tenantId: mctx.tenantId,
            valueStreamId: input.valueStreamId,
            toGate: input.toGate,
            ...data,
          },
          select: { id: true },
        });

    return ok({
      result: { id: row.id },
      audit: {
        action: "stage_gate.approvers.configured" as const,
        resourceType: "stage_gate_approver_rule" as const,
        resourceId: row.id,
        changes: {
          toGate: { before: previous?.id ? input.toGate : null, after: input.toGate },
          required: { before: previous?.required ?? null, after: input.required },
          approverUserIds: {
            before: previous?.approverUserIds ?? null,
            after: input.approverUserIds,
          },
          approverRoles: { before: previous?.approverRoles ?? null, after: roles },
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Lesepfade
// ---------------------------------------------------------------------------

/** Eine Abnahme-Zeile, wie die Read-Models sie brauchen. */
export interface GateApprovalView {
  id: string;
  userId: string;
  role: string | null;
  status: ApprovalStatus;
  decidedAt: Date | null;
  comment: string | null;
}

export interface OpenGateTransitionView {
  id: string;
  fromGate: GateStep;
  toGate: GateStep;
  quorum: Quorum;
  requestedBy: string;
  requestedAt: Date;
  reason: string | null;
  approvers: GateApprovalView[];
}

/** Der offene Antrag eines Epics, oder `null`. */
export async function getOpenGateTransition(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  epicId: string,
): Promise<OpenGateTransitionView | null> {
  const row = await db.stageGateTransition.findFirst({
    where: { tenantId, initiativeId: epicId, status: "pending" },
    select: {
      id: true,
      fromGate: true,
      toGate: true,
      quorum: true,
      requestedBy: true,
      requestedAt: true,
      reason: true,
      approvals: {
        select: {
          id: true,
          approverUserId: true,
          role: true,
          status: true,
          decidedAt: true,
          comment: true,
        },
        orderBy: { requestedAt: "asc" },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    fromGate: row.fromGate as GateStep,
    toGate: row.toGate as GateStep,
    quorum: isQuorum(row.quorum) ? row.quorum : "all",
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    reason: row.reason,
    approvers: row.approvals.map((a) => ({
      id: a.id,
      userId: a.approverUserId,
      role: a.role,
      status: a.status as ApprovalStatus,
      decidedAt: a.decidedAt,
      comment: a.comment,
    })),
  };
}

export interface GateTransitionHistoryRow {
  id: string;
  fromGate: GateStep;
  toGate: GateStep;
  kind: "forward" | "revert";
  status: GateTransitionStatus;
  requestedBy: string;
  requestedAt: Date;
  resolvedAt: Date | null;
  reason: string | null;
}

/** Die Antragshistorie eines Epics, neueste zuerst. */
export async function listGateTransitions(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  epicId: string,
  limit = 20,
): Promise<GateTransitionHistoryRow[]> {
  const rows = await db.stageGateTransition.findMany({
    where: { tenantId, initiativeId: epicId },
    orderBy: { requestedAt: "desc" },
    take: limit,
    select: {
      id: true,
      fromGate: true,
      toGate: true,
      kind: true,
      status: true,
      requestedBy: true,
      requestedAt: true,
      resolvedAt: true,
      reason: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fromGate: r.fromGate as GateStep,
    toGate: r.toGate as GateStep,
    kind: r.kind === "revert" ? "revert" : "forward",
    status: r.status as GateTransitionStatus,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt,
    resolvedAt: r.resolvedAt,
    reason: r.reason,
  }));
}

/**
 * Offene Anträge über viele Epics — für den Kanban-Chip „⇧ L3 beantragt · 1/2".
 * Eine Query, danach in der App gruppiert (Muster: `countEpicChildFeatures`).
 */
export async function countPendingGateRequests(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  epicIds: string[],
): Promise<Map<string, { toGate: GateStep; pendingCount: number; totalCount: number }>> {
  if (epicIds.length === 0) return new Map();
  const rows = await db.stageGateTransition.findMany({
    where: { tenantId, status: "pending", initiativeId: { in: epicIds } },
    select: {
      initiativeId: true,
      toGate: true,
      approvals: { select: { status: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.initiativeId,
      {
        toGate: r.toGate as GateStep,
        pendingCount: r.approvals.filter((a) => a.status === "pending").length,
        totalCount: r.approvals.length,
      },
    ]),
  );
}

/** Die konfigurierten Abnehmer-Regeln (Tenant-Default + optional ein Wertstrom). */
export async function listGateApproverRules(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  valueStreamId?: string | null,
): Promise<GateApproverRuleRow[]> {
  const rows = await db.stageGateApproverRule.findMany({
    where: {
      tenantId,
      ...(valueStreamId !== undefined &&
        (valueStreamId
          ? { OR: [{ valueStreamId }, { valueStreamId: null }] }
          : { valueStreamId: null })),
    },
    select: {
      valueStreamId: true,
      toGate: true,
      required: true,
      quorum: true,
      approverUserIds: true,
      approverRoles: true,
    },
    orderBy: [{ valueStreamId: "asc" }, { toGate: "asc" }],
  });
  return rows as GateApproverRuleRow[];
}

/**
 * Die Reife für den nächsten Schritt eines Epics — der Lesepfad, den das
 * Read-Model braucht. Kein Schreiben; genau das ist der Punkt.
 */
export async function loadGateReadiness(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  epicId: string,
  to: GateStep,
) {
  const facts = await loadEpicGateFacts(db as Prisma.TransactionClient, tenantId, epicId);
  return facts ? gateReadiness(facts, to) : null;
}

export type { MutationContext };
