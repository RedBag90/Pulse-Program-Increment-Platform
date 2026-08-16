import type { Prisma } from "@/generated/prisma";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err } from "@/modules/core/kernel/domain/errors";
import type { MutationContext } from "@/modules/core/kernel/server/mutation";
import { effectivePractices } from "@/modules/core/kernel/domain/operating-model";
import { emitAuditEvent } from "@/server/audit/emit";
import {
  parseBenefitHypothesis,
  benefitHypothesisHasContent,
} from "@/modules/work/domain/benefit-hypothesis";
import {
  parseBusinessCase,
  businessCaseHasContent,
} from "@/modules/work/domain/business-case";
import {
  decideGate,
  type EpicGateState,
  type GateDecision,
  type GateTrigger,
} from "@/modules/work/domain/stage-gate-engine";

// ---------------------------------------------------------------------------
// Stage-Gate Engine — the IMPURE adapter around the pure L0–L5 brain.
//
// This module is a *leaf*: it imports only the pure domain, the kernel, Prisma
// and the audit sink. It deliberately never imports `epic.ts`, `feature.ts`,
// `epic-approval.ts` or `budgeting.ts` — those import *down* into this adapter,
// which is what dissolves the old `epic.ts`↔`feature.ts` import cycle.
//
// It materializes the `EpicGateState` from persisted data, injects `now`
// (the only clock in the whole engine), persists the resulting column patch and
// emits the audit; the decision itself is delegated to the pure `decideGate`.
// ---------------------------------------------------------------------------

/** Sums the persisted per-period budget allocation JSON (`{ "YYYY-H1": n, … }`). */
function sumAllocations(allocations: Prisma.JsonValue | null | undefined): number {
  if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) return 0;
  return Object.values(allocations as Record<string, unknown>).reduce<number>(
    (sum, v) => sum + (typeof v === "number" && Number.isFinite(v) ? v : 0),
    0,
  );
}

/** Loads the active target operating model's effective practice flags. */
async function loadPractices(tx: Prisma.TransactionClient, tenantId: string) {
  const model = await tx.targetOperatingModel.findFirst({
    where: { tenantId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
  return effectivePractices(model);
}

/**
 * Materializes everything the pure engine needs about one Epic in a single pass:
 * the Epic row, its child-Feature roll-up, its persisted budget allocation Σ and
 * the `multiPartyApproval` practice. Returns null when the Epic does not exist.
 */
export async function loadEpicGateState(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  epicId: string,
): Promise<EpicGateState | null> {
  const row = await tx.initiative.findFirst({
    where: {
      id: epicId,
      tenantId: mctx.tenantId,
      level: InitiativeLevel.EPIC,
      deletedAt: null,
    },
    select: {
      stageGate: true,
      ownerId: true,
      proposedStageGate: true,
      hypothesisApprovedAt: true,
      businessCaseApprovedAt: true,
      selectedForDetailingAt: true,
      selectedForAnalyzingAt: true,
      implementationStartedAt: true,
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
    tenantId: mctx.tenantId,
    level: InitiativeLevel.FEATURE,
    deletedAt: null,
  };
  const [total, started, completed] = await Promise.all([
    tx.initiative.count({ where: childWhere }),
    tx.initiative.count({ where: { ...childWhere, status: { in: ["in_progress", "completed"] } } }),
    tx.initiative.count({ where: { ...childWhere, status: "completed" } }),
  ]);

  const practices = await loadPractices(tx, mctx.tenantId);

  return {
    actorId: mctx.actorId,
    stageGate: row.stageGate as StageGate,
    ownerId: row.ownerId,
    proposedStageGate: (row.proposedStageGate as StageGate | null) ?? null,
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
    approvedAt: row.approvedAt,
    impactRecognizedAt: row.impactRecognizedAt,
    multiPartyApproval: practices.multiPartyApproval,
  };
}

/**
 * THE impure entry point: resolve practices + state, run the pure decision,
 * persist the column patch (suggest OR advance) and emit the stage-gate audit
 * (advance only — a `suggest` is a transient, cleared-on-confirm proposal and is
 * intentionally not audited in v1). No-op when stage gates are off or the Epic
 * is gone. Deterministic apart from the single injected `new Date()`.
 */
export async function runGateEngine(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  epicId: string,
  move: Parameters<typeof decideGate>[1],
  opts?: { emitAudit?: boolean },
): Promise<GateDecision> {
  const practices = await loadPractices(tx, mctx.tenantId);
  if (!practices.stageGates) return { kind: "noop" };

  const state = await loadEpicGateState(tx, mctx, epicId);
  if (!state) return { kind: "noop" };

  const decision = decideGate(state, move, new Date());

  if (decision.kind === "suggest" || decision.kind === "advance") {
    await tx.initiative.update({
      where: { id: epicId },
      data: {
        ...(decision.stamps as Prisma.InitiativeUncheckedUpdateInput),
        updatedBy: mctx.actorId,
      },
    });
  }

  // On `advance`, emit the canonical `stage_gate.advanced` audit — UNLESS the
  // caller is a Result-returning wrapper (`confirm`/`manual`) whose own
  // `withAuditedTransaction` owns the single audit row for the operation. A
  // fire-and-forget `signalGateTrigger` (default `emitAudit`) has no such slot,
  // so it self-emits here. A `suggest` is never audited (transient proposal).
  if (decision.kind === "advance" && opts?.emitAudit !== false) {
    await emitAuditEvent(tx, {
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      action: "initiative.stage_gate.advanced",
      resourceType: "initiative",
      resourceId: epicId,
      changes: {
        stageGate: { before: decision.from, after: decision.toGate },
        ...(decision.comment ? { comment: { before: null, after: decision.comment } } : {}),
      },
      ipAddress: mctx.ipAddress,
      userAgent: mctx.userAgent,
    });
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Writer-facing wrappers. Every gate writer imports one of these three.
// ---------------------------------------------------------------------------

/**
 * Reports a content fact to the engine (a Feature started, the Business Case got
 * content, …). Triggers never block: a trigger either advances (the L0→L1
 * exception), records a proposal, or is a no-op. Fire-and-forget.
 */
export async function signalGateTrigger(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  epicId: string,
  trigger: GateTrigger,
): Promise<void> {
  await runGateEngine(tx, mctx, epicId, { kind: "trigger", trigger });
}

/** Maps the engine's `block` error onto the kernel's `Result` err shapes. */
function blockToErr(error: { kind: "forbidden" | "conflict" | "hierarchy_violation"; reason: string }): Result<never> {
  switch (error.kind) {
    case "forbidden":
      return err({ kind: "forbidden" as const, reason: error.reason });
    case "conflict":
      return err({ kind: "conflict" as const, reason: error.reason });
    case "hierarchy_violation":
      return err({
        kind: "hierarchy_violation" as const,
        violatedConstraint: "stage_gate_transition",
        detail: error.reason,
      });
  }
}

/** Turns a gate decision into a `{from,to}` Result (advance = ok, else = err). */
function decisionToResult(decision: GateDecision): Result<{ from: StageGate; to: StageGate }> {
  switch (decision.kind) {
    case "advance":
      return ok({ from: decision.from, to: decision.toGate });
    case "block":
      return blockToErr(decision.error);
    default:
      // `noop` / `suggest` — nothing advanced, surface as a conflict.
      return err({ kind: "conflict" as const, reason: "Kein Advance möglich" });
  }
}

/**
 * Owner confirms the persisted gate proposal, advancing the Epic. The engine
 * re-validates the proposal against the *current* state (it may have gone stale)
 * before advancing.
 */
export async function confirmProposedAdvance(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  epicId: string,
  opts?: { comment?: string | undefined },
): Promise<Result<{ from: StageGate; to: StageGate }>> {
  const decision = await runGateEngine(
    tx,
    mctx,
    epicId,
    { kind: "confirm", comment: opts?.comment },
    // The calling action's withAuditedTransaction owns the single audit row.
    { emitAudit: false },
  );
  return decisionToResult(decision);
}

/**
 * Manual (portfolio-scoped) gate move — the forward guards and the
 * regression/correction rules all live in the pure engine now.
 */
export async function advanceGateManually(
  tx: Prisma.TransactionClient,
  mctx: MutationContext,
  epicId: string,
  to: StageGate,
  comment?: string | undefined,
): Promise<Result<{ from: StageGate; to: StageGate }>> {
  const decision = await runGateEngine(
    tx,
    mctx,
    epicId,
    { kind: "manual", to, comment },
    // The calling action's withAuditedTransaction owns the single audit row.
    { emitAudit: false },
  );
  return decisionToResult(decision);
}
