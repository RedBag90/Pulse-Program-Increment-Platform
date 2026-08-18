import type { StageGate } from "@/modules/core/kernel/domain/types";

// ---------------------------------------------------------------------------
// Stage-gate model — the canonical source for the L0–L5 lifecycle.
//
// Pure, in-process: no I/O. The service layer loads the Epic and persists the
// transition; this module owns *which* transitions are legal and what they mean.
// ---------------------------------------------------------------------------

/** All stage gates, ordered L0 (Funnel) → L5. The canonical runtime list. */
export const STAGE_GATES = [
  "L0",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
] as const satisfies readonly StageGate[];

/**
 * Allowed stage-gate transitions: a gate may advance one step or step back one
 * step. L0 and L5 are the endpoints.
 */
export const STAGE_GATE_TRANSITIONS: Record<StageGate, readonly StageGate[]> = {
  L0: ["L1"],
  L1: ["L0", "L2"],
  L2: ["L1", "L3"],
  L3: ["L2", "L4"],
  L4: ["L3", "L5"],
  L5: ["L4"],
};

/** True when `to` is a permitted next gate from `from`. */
export function isValidTransition(from: StageGate, to: StageGate): boolean {
  return STAGE_GATE_TRANSITIONS[from].includes(to);
}

/**
 * Reaching L3 (Portfolio Backlog) is the Epic approval decision. Returns true
 * only when a transition first enters L3, so callers know to persist the
 * approver, timestamp, and comment on the Epic itself.
 */
export function isApprovalTransition(from: StageGate, to: StageGate): boolean {
  return to === "L3" && from !== "L3";
}


// ---------------------------------------------------------------------------
// Sub-stages — derived UI affordances within the major gates.
//
// Two of the six major gates carry an internally meaningful split:
//
// - **L2** splits into L2.1 "Business Case wird verfasst" and L2.2
//   "Business Case freigegeben". The split is derived from `businessCase`
//   and `businessCaseApprovedAt` on the Epic.
//
// - **L4** splits into L4.1 "Umsetzung läuft" and L4.2 "Umsetzung fertig".
//   The split is derived from the child-feature completion ratio: all
//   features completed → L4.2, anything earlier → L4.1.
//
// Sub-stages are deliberately NOT persisted. They are computed from the
// state that already exists. Keeping them derived means we can iterate on
// the rule without schema migrations, and the audit-log remains anchored
// on the major gates.
// ---------------------------------------------------------------------------

export const SUB_STAGES = ["L2.1", "L2.2", "L4.1", "L4.2"] as const;
export type SubStage = (typeof SUB_STAGES)[number];

/**
 * Major-Gate → seine Sub-Stages, in chronologischer Reihenfolge.
 * Genutzt von UI-Komponenten (Funnel-Bar, Reifegrad-Track) die unter dem
 * Major-Gate-Pill die Sub-Stage-Pills rendern.
 */
export const SUB_STAGES_BY_GATE: Partial<Record<StageGate, readonly SubStage[]>> = {
  L2: ["L2.1", "L2.2"],
  L4: ["L4.1", "L4.2"],
};

export interface SubStageInput {
  stageGate: StageGate;
  /** Epic's `businessCase` JSON column — used as "BC creation has started" signal. */
  businessCase: unknown;
  /** Stamp set when the BC clears its full approval flow. */
  businessCaseApprovedAt: Date | null;
  /** Aggregated child-feature counts (parent = this Epic). */
  childFeatureStats: { total: number; completed: number };
}

/**
 * The single "all child features completed" rule (L4.2 / the `features_completed`
 * gate trigger). One definition, shared by {@link subStageFor} and the
 * stage-gate engine — previously duplicated across three call sites.
 */
export function allChildrenCompleted(stats: { total: number; completed: number }): boolean {
  return stats.total > 0 && stats.completed === stats.total;
}

/**
 * Pure derivation: returns the sub-stage label inside L2 or L4, or `null`
 * for the other major gates (no split there).
 */
export function subStageFor(input: SubStageInput): SubStage | null {
  if (input.stageGate === "L2") {
    if (input.businessCaseApprovedAt != null) return "L2.2";
    if (input.businessCase != null) return "L2.1";
    return null;
  }
  if (input.stageGate === "L4") {
    return allChildrenCompleted(input.childFeatureStats) ? "L4.2" : "L4.1";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Kein Kanban-Bucket mehr.
//
// `epicBucket()` wich in zwei Fällen bewusst vom persistierten `stageGate` ab
// (L0 + Owner → L1-Spalte, L2 + BC freigegeben → L3-Spalte). Diese Abweichung
// existierte, weil das Gate hinter der Wirklichkeit *herlief*: der Reifegrad
// bewegte sich erst, wenn irgendwann ein Trigger feuerte, also zeigte das Board
// lieber, wo das Epic „eigentlich" schon stand.
//
// Mit dem manuellen, abgenommenen Wechsel gibt es dieses Auseinanderlaufen
// nicht mehr: das Gate ist genau da, wo jemand es hingeschoben hat. Das Board
// zeigt deshalb `stageGate` direkt — und daneben, ob ein Wechsel beantragt ist.
// Damit fällt die zweite von drei parallelen Ableitungen von „wo steht dieses
// Epic" weg.
// ---------------------------------------------------------------------------
