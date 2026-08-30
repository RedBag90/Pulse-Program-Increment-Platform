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

// ---------------------------------------------------------------------------
// Gate-Steps — die Schritte, die beantragt und abgenommen werden.
//
// Die Reifegrad-Leiter hat sechs Haupt-Gates (L0–L5), aber **sieben** Schritte:
// zwischen „Umsetzung gestartet" (L4) und „Impact bestätigt" (L5) liegt die
// Bestätigung, dass die Umsetzung fertig ist — **L4.2**. Sie ist bewusst ein
// eigener, beantragter und abgenommener Schritt: „fertig gebaut" und „Nutzen
// nachgewiesen" sind zwei Aussagen, zwischen denen viel Zeit liegen darf.
//
// L4.2 ist trotzdem kein Haupt-Gate: `Initiative.stageGate` bleibt auf „L4"
// stehen: die Bestätigung materialisiert sich im Stempel
// `implementationCompletedAt`. Der Schritt-Typ existiert nur im
// Antrags-/Abnahme-Apparat (Policies, Kriterien, Historie).
// ---------------------------------------------------------------------------

/** Alle beantragbaren Schritte in Reihenfolge — L0 … L4, L4.2, L5. */
export const GATE_STEPS = ["L0", "L1", "L2", "L3", "L4", "L4.2", "L5"] as const;
export type GateStep = (typeof GATE_STEPS)[number];

export function isGateStep(value: string): value is GateStep {
  return (GATE_STEPS as readonly string[]).includes(value);
}

/** Erlaubte Schritt-Wechsel: ein Schritt vor oder zurück. */
export const GATE_STEP_TRANSITIONS: Record<GateStep, readonly GateStep[]> = {
  L0: ["L1"],
  L1: ["L0", "L2"],
  L2: ["L1", "L3"],
  L3: ["L2", "L4"],
  L4: ["L3", "L4.2"],
  "L4.2": ["L4", "L5"],
  L5: ["L4.2"],
};

/** True, wenn `to` ein erlaubter Nachbar-Schritt von `from` ist. */
export function isValidStepTransition(from: GateStep, to: GateStep): boolean {
  return GATE_STEP_TRANSITIONS[from].includes(to);
}

/** Das Haupt-Gate, in dem ein Schritt lebt — „L4.2" gehört zu L4. */
export function gateOfStep(step: GateStep): StageGate {
  return step === "L4.2" ? "L4" : step;
}

/**
 * Der Schritt, auf dem ein Epic **aktuell** steht: innerhalb von L4 entscheidet
 * die Bestätigung der fertigen Umsetzung, ob das Epic schon auf L4.2 steht.
 * Überall dort zu verwenden, wo bisher `epic.stageGate` den nächsten Antrag
 * bestimmt hat.
 */
export function currentGateStep(epic: {
  stageGate: StageGate;
  implementationCompletedAt: Date | null;
}): GateStep {
  return epic.stageGate === "L4" && epic.implementationCompletedAt != null
    ? "L4.2"
    : epic.stageGate;
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
//   L4.2 wird **beantragt und abgenommen** (wie ein Gate, s. `GATE_STEPS`) und
//   materialisiert sich im Stempel `implementationCompletedAt` — früher fiel
//   das Epic automatisch auf L4.2, sobald alle Features fertig waren. „Alle
//   Features abgeschlossen" ist jetzt die *Voraussetzung* des Antrags, nicht
//   mehr die Bestätigung selbst.
//
// Die Ableitung liest damit nur noch persistierte Fakten (BC-Stempel,
// Bestätigungs-Stempel); der Audit-Log der Haupt-Gates bleibt unberührt.
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
  /** Stempel der abgenommenen L4.2-Bestätigung („Umsetzung fertig"). */
  implementationCompletedAt: Date | null;
}

/**
 * The single "all child features completed" rule — Voraussetzung des
 * L4.2-Antrags (Kriterium `features_completed`). Sie **bestätigt** die fertige
 * Umsetzung nicht mehr selbst; das tut die Abnahme.
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
    // Bestätigt (abgenommener L4→L4.2-Antrag) ⇒ L4.2, sonst läuft die Umsetzung.
    return input.implementationCompletedAt != null ? "L4.2" : "L4.1";
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
