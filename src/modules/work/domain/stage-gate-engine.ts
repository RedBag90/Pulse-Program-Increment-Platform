import type { StageGate } from "@/modules/core/kernel/domain/types";
import {
  isValidTransition,
  isApprovalTransition,
  autoAdvanceTarget,
  allChildrenCompleted,
} from "@/modules/work/domain/stage-gate";
import {
  findBlockedManualTransition,
  manualForwardBlockReason,
} from "@/modules/work/domain/epic-lifecycle-doc";

// ---------------------------------------------------------------------------
// Stage-Gate Engine — the one PURE brain for the L0–L5 investment funnel.
//
// Behaviour model (suggest-confirm): a *content trigger* proposes the next gate;
// the *Epic owner* confirms it. The proposal is persisted on the Epic
// (`proposedStageGate`/`proposedBy`/`proposedAt`). The single exception is
// L0→L1: the Portfolio Manager approving the benefit hypothesis IS the
// confirmation, so that trigger advances directly.
//
// This module has NO I/O and no clock: it is a total function of
// (EpicGateState, GateMove, now). The impure `server/services/stage-gate-engine.ts`
// adapter materializes the state, injects `now`, persists the resulting patch and
// emits the audit — every gate writer imports *down* into that adapter, which
// dissolves the old `epic.ts`↔`feature.ts` import cycle.
// ---------------------------------------------------------------------------

/** Everything the engine needs about one Epic, materialized once by the adapter. */
export interface EpicGateState {
  /** Who is acting — becomes approvedBy / impactRecognizedBy / proposedBy. */
  actorId: string;
  stageGate: StageGate;
  ownerId: string | null;

  /** The persisted suggestion (suggest-confirm asymmetry lives here). */
  proposedStageGate: StageGate | null;

  // Content signals the triggers read (all derived from persisted state).
  hypothesisApprovedAt: Date | null;
  hasHypothesisContent: boolean;
  hasBusinessCaseContent: boolean;
  businessCaseApprovedAt: Date | null;
  budgetAllocationSum: number;
  childFeatureStats: ChildFeatureStats;

  // Already-set stamps — read so the engine never re-stamps (set-once).
  selectedForDetailingAt: Date | null;
  selectedForAnalyzingAt: Date | null;
  implementationStartedAt: Date | null;
  approvedAt: Date | null;
  impactRecognizedAt: Date | null;

  /** multiPartyApproval practice — needed by the hypothesis-ready precondition. */
  multiPartyApproval: boolean;
}

export interface ChildFeatureStats {
  total: number;
  started: number;
  completed: number;
}

// ---------------------------------------------------------------------------
// Named predicate vocabulary — pure over EpicGateState, reused across triggers.
// ---------------------------------------------------------------------------

/** L0→L1: hypothesis approved (multi-party) or drafted (single-party). */
export function hypothesisReady(s: EpicGateState): boolean {
  return s.multiPartyApproval ? s.hypothesisApprovedAt != null : s.hasHypothesisContent;
}

// ---------------------------------------------------------------------------
// Moves & decisions
// ---------------------------------------------------------------------------

/** The content facts a writer reports; the engine resolves the gate. */
export type GateTrigger =
  | "hypothesis_approved" // PM approved benefit hypothesis  → L1 (the exception: advances)
  | "business_case_saved" // BC content persisted            → suggest L2
  | "budget_allocated" // participatory budget Σ>0 saved      → suggest L3
  | "feature_started" // first child feature in_progress      → suggest L4
  | "features_completed"; // all child features completed      → suggest L5

export type GateMove =
  | { kind: "trigger"; trigger: GateTrigger }
  | { kind: "confirm"; comment?: string | undefined }
  | { kind: "manual"; to: StageGate; comment?: string | undefined };

/** The exact column patch to persist. Every field already resolved to a value. */
export interface GateStamps {
  stageGate?: StageGate;
  selectedForDetailingAt?: Date;
  selectedForAnalyzingAt?: Date;
  implementationStartedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  approvalComment?: string | null;
  impactRecognizedBy?: string;
  impactRecognizedAt?: Date;
  impactComment?: string | null;
  proposedStageGate?: StageGate | null;
  proposedBy?: string | null;
  proposedAt?: Date | null;
}

export type GateBlockKind = "forbidden" | "conflict" | "hierarchy_violation";

export type GateDecision =
  | { kind: "noop" }
  | { kind: "suggest"; toGate: StageGate; trigger: GateTrigger; stamps: GateStamps }
  | {
      kind: "advance";
      from: StageGate;
      toGate: StageGate;
      isApproval: boolean;
      stamps: GateStamps;
      comment?: string | undefined;
    }
  | { kind: "block"; error: { kind: GateBlockKind; reason: string } };

/** A trigger's static shape: which gates it bridges, its content predicate, mode. */
interface TriggerRule {
  from: StageGate;
  to: StageGate;
  /** Confirmed by the owner ("owner") or applied directly ("auto", L0→L1 only). */
  confirm: "auto" | "owner";
  ready: (s: EpicGateState) => boolean;
}

const TRIGGER_RULES: Record<GateTrigger, TriggerRule> = {
  hypothesis_approved: { from: "L0", to: "L1", confirm: "auto", ready: hypothesisReady },
  business_case_saved: {
    from: "L1",
    to: "L2",
    confirm: "owner",
    ready: (s) => s.hasBusinessCaseContent,
  },
  budget_allocated: {
    from: "L2",
    to: "L3",
    confirm: "owner",
    ready: (s) => s.businessCaseApprovedAt != null && s.budgetAllocationSum > 0,
  },
  feature_started: {
    from: "L3",
    to: "L4",
    confirm: "owner",
    ready: (s) => s.childFeatureStats.started > 0,
  },
  features_completed: {
    from: "L4",
    to: "L5",
    confirm: "owner",
    ready: (s) => allChildrenCompleted(s.childFeatureStats),
  },
};

/** Which trigger's transition ends at a given gate — for re-validating a proposal. */
function ruleEndingAt(to: StageGate): TriggerRule | undefined {
  return Object.values(TRIGGER_RULES).find((r) => r.to === to);
}

/**
 * Gate-near stamps for landing on `to`. Set-once: a stamp is written only when
 * the corresponding `*At` in state is still null. Always clears the proposal.
 */
function stampsForAdvance(
  state: EpicGateState,
  to: StageGate,
  now: Date,
  comment?: string | undefined,
): GateStamps {
  const isApproval = isApprovalTransition(state.stageGate, to);
  return {
    stageGate: to,
    ...(to === "L1" && state.selectedForDetailingAt == null && { selectedForDetailingAt: now }),
    ...(to === "L2" && state.selectedForAnalyzingAt == null && { selectedForAnalyzingAt: now }),
    ...(to === "L4" && state.implementationStartedAt == null && { implementationStartedAt: now }),
    ...(isApproval &&
      state.approvedAt == null && {
        approvedBy: state.actorId,
        approvedAt: now,
        approvalComment: comment ?? null,
      }),
    ...(to === "L5" &&
      state.impactRecognizedAt == null && {
        impactRecognizedBy: state.actorId,
        impactRecognizedAt: now,
        impactComment: comment ?? null,
      }),
    // Advancing always consumes any pending proposal.
    proposedStageGate: null,
    proposedBy: null,
    proposedAt: null,
  };
}

/**
 * THE pure entry point. Deterministic: same (state, move, now) ⇒ same decision.
 * `noop` = nothing to do (idempotent); `suggest` = persist the proposal only;
 * `advance` = move the gate + stamps (+ clear proposal); `block` = rejected.
 */
export function decideGate(state: EpicGateState, move: GateMove, now: Date): GateDecision {
  switch (move.kind) {
    case "trigger": {
      const rule = TRIGGER_RULES[move.trigger];
      // Single-step ordering: a trigger only fires from its expected predecessor.
      if (state.stageGate !== rule.from) return { kind: "noop" };
      if (!rule.ready(state)) return { kind: "noop" };

      if (rule.confirm === "auto") {
        return {
          kind: "advance",
          from: state.stageGate,
          toGate: rule.to,
          isApproval: isApprovalTransition(state.stageGate, rule.to),
          stamps: stampsForAdvance(state, rule.to, now),
        };
      }
      // Owner-confirmed: persist the proposal, unless already proposed to this gate.
      if (state.proposedStageGate === rule.to) return { kind: "noop" };
      return {
        kind: "suggest",
        toGate: rule.to,
        trigger: move.trigger,
        stamps: {
          proposedStageGate: rule.to,
          proposedBy: state.actorId,
          proposedAt: now,
        },
      };
    }

    case "confirm": {
      const to = state.proposedStageGate;
      if (to == null) {
        return { kind: "block", error: { kind: "conflict", reason: "Kein Gate-Vorschlag offen." } };
      }
      // The proposal must still be a legal single-step advance from the current gate.
      if (autoAdvanceTarget(state.stageGate, to) == null || !isValidTransition(state.stageGate, to)) {
        return {
          kind: "block",
          error: {
            kind: "conflict",
            reason: `Vorschlag (${to}) ist nicht mehr gültig — Epic ist auf ${state.stageGate}.`,
          },
        };
      }
      // The content that motivated the proposal must still hold (state may have moved).
      const rule = ruleEndingAt(to);
      if (rule && !rule.ready(state)) {
        return {
          kind: "block",
          error: {
            kind: "conflict",
            reason: `Vorschlag (${to}) ist nicht mehr gedeckt — Voraussetzung entfallen.`,
          },
        };
      }
      return {
        kind: "advance",
        from: state.stageGate,
        toGate: to,
        isApproval: isApprovalTransition(state.stageGate, to),
        stamps: stampsForAdvance(state, to, now, move.comment),
        comment: move.comment,
      };
    }

    case "manual": {
      const from = state.stageGate;
      const to = move.to;
      if (!isValidTransition(from, to)) {
        return {
          kind: "block",
          error: { kind: "hierarchy_violation", reason: `Kein Wechsel von ${from} nach ${to}.` },
        };
      }
      const blocked = findBlockedManualTransition(from, to);
      if (blocked) return { kind: "block", error: { kind: "forbidden", reason: blocked.reason } };

      const blockReason = manualForwardBlockReason(from, to, {
        multiPartyApproval: state.multiPartyApproval,
        hypothesisApprovedAt: state.hypothesisApprovedAt,
        hasHypothesisContent: state.hasHypothesisContent,
        hasBusinessCaseContent: state.hasBusinessCaseContent,
        startedChildFeatureCount: state.childFeatureStats.started,
      });
      if (blockReason) return { kind: "block", error: { kind: "forbidden", reason: blockReason } };

      return {
        kind: "advance",
        from,
        toGate: to,
        isApproval: isApprovalTransition(from, to),
        // Regression (correction) sets no forward stamp; stampsForAdvance guards each
        // stamp by target gate + null-check, so a step-back only clears the proposal.
        stamps: stampsForAdvance(state, to, now, move.comment),
        comment: move.comment,
      };
    }
  }
}
