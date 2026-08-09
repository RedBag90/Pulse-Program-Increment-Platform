import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { SubStage } from "@/modules/work/domain/stage-gate";

/**
 * Single-Source-of-Truth fuer Doku des Epic-Lebenszyklus.
 *
 * Diese Konstanten speisen die zwei UI-Help-Popover
 * (`StageGateLifecycleHelp` an der Reifegrad-Bar, `KanbanBucketHelp` am
 * Portfolio-Kanban),
 * Onboarding-Texte und koennen optional von Tests gegen die echten
 * Service-Pfade geprueft werden. Wer die Auto-Advance-Logik aendert,
 * passt hier den Eintrag mit an — drift fliegt im Code-Review auf.
 *
 * Wichtig: hier nichts berechnen. Diese Datei ist pure data. Die echten
 * Trigger leben in `epic.ts`, `epic-approval.ts`, `budgeting.ts`, etc.
 */

/** Ein Auto-Advance-Trigger: ein User-Event verschiebt das Stage-Gate. */
export interface LifecycleTrigger {
  /** Klick-/Save-Event in User-Sprache. */
  event: string;
  /** Von-Gate (welches Gate ueberhaupt voraussetzt). */
  stageFrom: StageGate;
  /** Nach-Gate (auto-advanced). */
  stageTo: StageGate;
  /** Sub-Stage die danach UI-seitig sichtbar wird, falls vorhanden. */
  subStageAfter?: SubStage;
  /** Code-Pfad als kurze Identifikation fuer Reviewer. */
  triggerLabel: string;
}

/** Ableitungsregel fuer eine Sub-Stage. */
export interface SubStageRule {
  gate: "L2" | "L4";
  key: SubStage;
  label: string;
  /** Text-Form der Bedingung — fuer Anzeige im Popover. */
  condition: string;
}

/** Mapping-Regel: welcher Datenzustand landet in welchem Kanban-Bucket. */
export interface BucketRule {
  stageGate: StageGate;
  /** Optionale Zusatzbedingung. Wenn null/leer, gilt die Regel fuer den Stage-Gate-Default. */
  precondition: string | null;
  bucket: StageGate;
  bucketLabel: string;
}

/** Manuelle Transition, die das System bewusst verbietet. */
export interface BlockedManualTransition {
  from: StageGate;
  to: StageGate;
  reason: string;
}

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------

export const LIFECYCLE_TRIGGERS: readonly LifecycleTrigger[] = [
  {
    event: "Hypothese-Section freigegeben (alle Approver approve)",
    stageFrom: "L0",
    stageTo: "L1",
    triggerLabel: "decideApproval (section=hypothesis) → autoAdvanceStageGate(L1)",
  },
  {
    event: "Business-Case-Inhalt im BC-Tab gespeichert (erster nicht-leerer Save)",
    stageFrom: "L1",
    stageTo: "L2",
    subStageAfter: "L2.1",
    triggerLabel: "saveBusinessCase mit Inhalt → autoAdvanceStageGate(L2)",
  },
  {
    event: "Participatory-Budget Σ > 0 gespeichert (BC bereits freigegeben)",
    stageFrom: "L2",
    stageTo: "L3",
    triggerLabel: "saveBudgetAllocation → autoAdvanceStageGate(L3)",
  },
  {
    event: "Erstes Child-Feature in Implementation gestartet",
    stageFrom: "L3",
    stageTo: "L4",
    subStageAfter: "L4.1",
    triggerLabel: "setFeatureDeliveryStatus(in_progress) → autoAdvanceStageGate(L4)",
  },
  {
    event: "Impact bestaetigt (verlangt Sub-Stage L4.2)",
    stageFrom: "L4",
    stageTo: "L5",
    triggerLabel: "confirmEpicImpact",
  },
];

export const SUB_STAGE_RULES: readonly SubStageRule[] = [
  {
    gate: "L2",
    key: "L2.1",
    label: "BC in Arbeit",
    condition: "businessCase != null && businessCaseApprovedAt == null",
  },
  {
    gate: "L2",
    key: "L2.2",
    label: "BC freigegeben",
    condition: "businessCaseApprovedAt != null",
  },
  {
    gate: "L4",
    key: "L4.1",
    label: "Umsetzung laeuft",
    condition: "completed < total (oder total == 0)",
  },
  {
    gate: "L4",
    key: "L4.2",
    label: "Umsetzung fertig",
    condition: "total > 0 && completed == total",
  },
];

export const BUCKET_RULES: readonly BucketRule[] = [
  { stageGate: "L0", precondition: "ownerId == null", bucket: "L0", bucketLabel: "Funnel" },
  {
    stageGate: "L0",
    precondition: "ownerId != null",
    bucket: "L1",
    bucketLabel: "Hypothese erstellen",
  },
  { stageGate: "L1", precondition: null, bucket: "L1", bucketLabel: "Hypothese erstellen" },
  {
    stageGate: "L2",
    precondition: "businessCaseApprovedAt == null",
    bucket: "L2",
    bucketLabel: "Analyzing",
  },
  {
    stageGate: "L2",
    precondition: "businessCaseApprovedAt != null",
    bucket: "L3",
    bucketLabel: "Portfolio Backlog",
  },
  { stageGate: "L3", precondition: null, bucket: "L3", bucketLabel: "Portfolio Backlog" },
  { stageGate: "L4", precondition: null, bucket: "L4", bucketLabel: "Implementing" },
  { stageGate: "L5", precondition: null, bucket: "L5", bucketLabel: "Done" },
];

export const BLOCKED_MANUAL_TRANSITIONS: readonly BlockedManualTransition[] = [
  {
    from: "L2",
    to: "L3",
    reason:
      "L3 wird automatisch beim Speichern eines Budgets > 0 erreicht (Voraussetzung: Sub-Stage L2.2 'BC freigegeben').",
  },
  {
    from: "L4",
    to: "L5",
    reason:
      "L5 wird nur per Impact-Bestaetigung erreicht (Voraussetzung: Sub-Stage L4.2 'Umsetzung fertig').",
  },
];

/**
 * Returns the blocked-manual-transition entry that matches `from → to`, or
 * `undefined` when the transition is allowed. The service's stage-gate guard
 * looks this up so the reason message comes from the same source as the
 * help-popover catalog — adding a new blocked pair is one entry in
 * `BLOCKED_MANUAL_TRANSITIONS`, no second touch in `services/epic.ts`.
 */
export function findBlockedManualTransition(
  from: string,
  to: string,
): BlockedManualTransition | undefined {
  return BLOCKED_MANUAL_TRANSITIONS.find((b) => b.from === from && b.to === to);
}

/** Zustand, den der Vorbedingungs-Guard für einen manuellen Advance braucht. */
export interface ManualAdvanceState {
  /** Läuft die Mehrparteien-Freigabe im Tenant? */
  multiPartyApproval: boolean;
  /** Wurde die Benefit-Hypothese freigegeben (Stempel gesetzt)? */
  hypothesisApprovedAt: Date | null;
  /** Inhalte in der Benefit-Hypothese vorhanden? */
  hasHypothesisContent: boolean;
  /** Inhalte im Business Case vorhanden? */
  hasBusinessCaseContent: boolean;
  /** Anzahl bereits gestarteter Child-Features (Status in_progress/completed). */
  startedChildFeatureCount: number;
}

/**
 * Vorbedingungs-Guard für **manuelle Vorwärts-Stage-Gate-Wechsel**. Gibt eine
 * Reason zurück, wenn der Wechsel die nötige Vorleistung überspringt — sonst
 * `null` (erlaubt). L1 **und** L2 verlangen eine freigegebene (bzw. bei ausge-
 * schalteter Mehrparteien-Freigabe: ausgearbeitete) Benefit-Hypothese — L2 ist der
 * Eintritt in die Analyse und steht vor „Business Case done" (BC-Inhalt ist erst
 * Voraussetzung fürs Business-Case-Einreichen, nicht hier). L3→L4 („Implementation
 * started") ist manuell ohne Vorbedingung erlaubt (der Feature-Start advanct L4
 * zusätzlich automatisch). L2→L3 / L4→L5 sind separat über `BLOCKED_MANUAL_TRANSITIONS`
 * gesperrt; Rückwärts-Wechsel (Korrektur) und alle übrigen Paare geben `null`.
 */
export function manualForwardBlockReason(
  from: string,
  to: string,
  state: ManualAdvanceState,
): string | null {
  if (from === "L0" && to === "L1") {
    if (state.multiPartyApproval) {
      return state.hypothesisApprovedAt != null
        ? null
        : "L1 verlangt eine vom Portfolio Manager freigegebene Benefit-Hypothese — reiche sie zuerst ein und lass sie entscheiden.";
    }
    return state.hasHypothesisContent
      ? null
      : "L1 verlangt eine ausgearbeitete Benefit-Hypothese — fülle sie zuerst im Hypothese-Tab aus.";
  }
  if (from === "L1" && to === "L2") {
    // L2 = Eintritt in die Analyse — steht VOR „Business Case done". Voraussetzung
    // ist die freigegebene/ausgearbeitete Benefit-Hypothese (L1-Deliverable), NICHT
    // ein Business Case (den schreibt man erst in der Analyse; BC-Inhalt ist Voraus-
    // setzung fürs Business-Case-Einreichen). Spiegelt L0→L1.
    if (state.multiPartyApproval) {
      return state.hypothesisApprovedAt != null
        ? null
        : "Analyse (L2) verlangt eine vom Portfolio Manager freigegebene Benefit-Hypothese — reiche sie zuerst ein und lass sie entscheiden.";
    }
    return state.hasHypothesisContent
      ? null
      : "Analyse (L2) verlangt eine ausgearbeitete Benefit-Hypothese — fülle sie zuerst im Hypothese-Tab aus.";
  }
  // L3→L4 (Implementation started) ist manuell **ohne** Vorbedingung erlaubt: der
  // Owner darf die Umsetzung explizit starten. Der Feature-Start advanct L4 zusätzlich
  // automatisch (autoAdvanceStageGate) — daher hier kein Guard mehr.
  return null;
}
