import type { StageGate } from "@/modules/core/kernel/domain/types";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import {
  isValidStepTransition,
  isApprovalTransition,
  isGateStep,
  gateOfStep,
  currentGateStep,
  GATE_STEPS,
  type GateStep,
} from "@/modules/work/domain/stage-gate";
import {
  type ApprovalDecision,
  type ApprovalStatus,
  type Quorum,
  decisionStatus,
  quorumReached,
  quorumRejected,
  pendingCount,
} from "@/modules/work/domain/approval-primitives";
import {
  type EpicGateFacts,
  type GateReadiness,
  gateReadiness,
  readinessBlockReason,
  nextGate,
} from "@/modules/work/domain/gate-readiness";
import type { GatePolicy, ResolvedApprover } from "@/modules/work/domain/gate-policy";

// ---------------------------------------------------------------------------
// Gate-Transition — die reine Entscheidungslogik des Reifegrad-Wechsels.
//
// Ersetzt `decideGate(state, move, now)`. Die alte Funktion hatte eine
// vierfache Ergebnis-Union (`noop | suggest | advance | block`), weil *eine*
// Funktion drei unverwandte Bewegungen bedienen musste: einen Trigger, eine
// Bestätigung und einen manuellen Sprung. `noop` war dabei kein Ergebnis,
// sondern ein Schulterzucken — ein Trigger, der ins Leere lief, war von einem
// Trigger, der korrekt nichts tat, nicht zu unterscheiden.
//
// Jetzt gibt es einen Vorgang mit drei Verben, und jedes Verb hat genau eine
// Ergebnisform:
//
//   planGateRequest             — jemand beantragt den Push
//   decideGateTransitionOutcome — ein benannter Abnehmer entscheidet
//   planGateRevert              — jemand korrigiert rückwärts
//
// Rein, kein I/O; `now` wird injiziert.
// ---------------------------------------------------------------------------

export const GATE_TRANSITION_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;
export type GateTransitionStatus = (typeof GATE_TRANSITION_STATUSES)[number];

/** Der exakte Spalten-Patch auf der Initiative-Zeile. Jedes Feld ist aufgelöst. */
export interface GateStamps {
  stageGate?: StageGate;
  selectedForDetailingAt?: Date | null;
  /**
   * Hypothesen-Freigabe. Die Abnahme des Schritts L0 → L1 **ist** sie — es gibt
   * keinen eigenen Freigabelauf mehr davor. `null` räumt sie beim Revert ab.
   */
  hypothesisApprovedAt?: Date | null;
  /** Eine inhaltliche Freigabe markiert das Epic fürs nächste Steering. */
  needsSteeringAttention?: boolean;
  selectedForAnalyzingAt?: Date | null;
  /**
   * Business-Case-Freigabe. Die Abnahme des Schritts L2 → L3.1 **ist** sie —
   * die fünf Parteien zeichnen dort. `null` räumt sie beim Revert ab.
   */
  businessCaseApprovedAt?: Date | null;
  implementationStartedAt?: Date | null;
  /**
   * L4.2-Bestätigung („Umsetzung fertig"). Gesetzt ⇒ der Service spiegelt den
   * Tag zusätzlich als `timeline.actuals.implementation`; `null` räumt beides ab.
   * Dieses Ist-Datum gehört **ausschließlich** der Abnahme — der Timeline-Reiter
   * zeigt es nur an.
   */
  implementationCompletedAt?: Date | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  approvalComment?: string | null;
  impactRecognizedBy?: string | null;
  impactRecognizedAt?: Date | null;
  impactComment?: string | null;
}

/**
 * Gate-nahe Stempel beim Vorrücken auf `to`. Set-once: ein Stempel wird nur
 * geschrieben, solange der zugehörige `*At`-Wert noch null ist.
 *
 * `actorId` ist der **entscheidende Abnehmer**, nicht mehr „wer den Trigger
 * ausgelöst hat". Damit trägt `approvedBy` bzw. `impactRecognizedBy` künftig die
 * Person, die tatsächlich unterschrieben hat — vorher war es etwa bei L5
 * derjenige, der zufällig den Impact-Dialog geöffnet hatte.
 */
export function stampsForAdvance(
  facts: EpicGateFacts,
  to: GateStep,
  actorId: string,
  now: Date,
  comment?: string | undefined,
): GateStamps {
  const isApproval = isApprovalTransition(to);
  return {
    // L3.2 und L4.2 leben innerhalb ihres Haupt-Gates: die Spalte bleibt stehen,
    // die Bestätigung materialisiert sich allein im jeweiligen Stempel.
    stageGate: gateOfStep(to),
    // L0 → L1 trägt die Hypothesen-Freigabe: die Abnahme *ist* sie. Deshalb
    // stempelt sie hier mit und setzt das Steering-Flag (das hing an
    // `decideHypothesis`).
    ...(to === "L1" && {
      ...(facts.selectedForDetailingAt == null && { selectedForDetailingAt: now }),
      ...(facts.hypothesisApprovedAt == null && { hypothesisApprovedAt: now }),
      needsSteeringAttention: true,
    }),
    ...(to === "L2" && facts.selectedForAnalyzingAt == null && { selectedForAnalyzingAt: now }),
    // L2 → L3.1 trägt die Business-Case-Freigabe — dieselbe Bewegung wie bei
    // L1, nur mit den fünf Parteien als Abnehmern.
    ...(to === "L3.1" && {
      ...(facts.businessCaseApprovedAt == null && { businessCaseApprovedAt: now }),
      needsSteeringAttention: true,
    }),
    ...(to === "L4" && facts.implementationStartedAt == null && { implementationStartedAt: now }),
    ...(to === "L4.2" &&
      facts.implementationCompletedAt == null && { implementationCompletedAt: now }),
    ...(isApproval &&
      facts.approvedAt == null && {
        approvedBy: actorId,
        approvedAt: now,
        approvalComment: comment ?? null,
      }),
    ...(to === "L5" &&
      facts.impactRecognizedAt == null && {
        impactRecognizedBy: actorId,
        impactRecognizedAt: now,
        impactComment: comment ?? null,
      }),
  };
}

/**
 * Der Gegenpart: welche Stempel ein Rückwärts-Schritt `from → to` **abräumt**.
 *
 * Hier stirbt ein echter Defekt. Bisher setzte ein Rückwärts-Schritt gar nichts
 * zurück, und weil die Stempel set-once sind, stempelte ein erneutes Vorrücken
 * danach nie wieder: ein einmal auf L3 gewesenes Epic behielt `approvedAt` für
 * immer, egal wie oft es korrigiert und neu freigegeben wurde. Wer die Historie
 * zurückdreht, muss auch die Spuren zurückdrehen.
 */
export function unwindStampsFor(from: GateStep, to: GateStep): GateStamps {
  const stamps: GateStamps = { stageGate: gateOfStep(to) };
  // Die Hypothesen-Freigabe zurücknehmen — sie hängt an L0 → L1.
  if (from === "L1" && to === "L0") {
    stamps.selectedForDetailingAt = null;
    stamps.hypothesisApprovedAt = null;
  }
  if (from === "L2" && to === "L1") stamps.selectedForAnalyzingAt = null;
  // Die Business-Case-Freigabe zurücknehmen — sie hängt an L2 → L3.1. Genau das
  // ist der Ersatz für die frühere „neue Revision": rückstufen mit Begründung,
  // überarbeiten, neu beantragen.
  if (from === "L3.1" && to === "L2") stamps.businessCaseApprovedAt = null;
  // Die Investitionsentscheidung zurücknehmen. Sie hängt am Schritt L3.1 → L3.2,
  // nicht am Eintritt in L3.1 — der trägt keinen eigenen Stempel.
  if (from === "L3.2" && to === "L3.1") {
    stamps.approvedBy = null;
    stamps.approvedAt = null;
    stamps.approvalComment = null;
  }
  // Die L4.2-Bestätigung zurücknehmen — direkt (L4.2 → L4) oder indem das Epic
  // L4 ganz verlässt. Der Service räumt damit auch das Timeline-Ist-Datum ab.
  if (from === "L4.2" && to === "L4") stamps.implementationCompletedAt = null;
  if (from === "L4" && to === "L3.2") {
    stamps.implementationStartedAt = null;
    stamps.implementationCompletedAt = null;
  }
  if (from === "L5" && to === "L4.2") {
    stamps.impactRecognizedBy = null;
    stamps.impactRecognizedAt = null;
    stamps.impactComment = null;
  }
  return stamps;
}

// ---------------------------------------------------------------------------
// Antrag
// ---------------------------------------------------------------------------

/** Was beim Anlegen eines Antrags geschrieben werden muss. */
export interface GateRequestPlan {
  from: GateStep;
  to: GateStep;
  quorum: Quorum;
  approvers: ResolvedApprover[];
  readiness: GateReadiness;
  /**
   * `true` ⇔ `policy.required === false`: die Antragszeile wird direkt als
   * `approved` geboren und das Gate rückt in derselben Transaktion vor. Immer
   * noch **ein** manueller, auditierter Akt — nur ohne Gegenzeichnung.
   */
  immediate: boolean;
  /** Nicht-null genau dann, wenn `immediate`. */
  stamps: GateStamps | null;
}

export interface PlanGateRequestInput {
  facts: EpicGateFacts;
  to: GateStep;
  policy: GatePolicy;
  approvers: ResolvedApprover[];
  actorId: string;
  hasOpenRequest: boolean;
  now: Date;
}

/**
 * Prüft einen Antrag vollständig und liefert den zu schreibenden Plan.
 *
 * Reihenfolge der Guards ist bewusst: erst die *strukturellen* Fehler (Ziel
 * existiert, ein Schritt, vorwärts), dann der Vorgangs-Konflikt (schon ein
 * Antrag offen), dann die *inhaltliche* Reife, zuletzt die Besetzung. So bekommt
 * der Nutzer immer den grundlegendsten Grund genannt statt eines Folgefehlers.
 */
export function planGateRequest(input: PlanGateRequestInput): Result<GateRequestPlan> {
  const { facts, to, policy, approvers, actorId, hasOpenRequest, now } = input;
  const from = currentGateStep(facts);

  if (!isGateStep(to)) {
    return err({
      kind: "validation" as const,
      issues: [`Unbekannter Reifegrad "${to}".`],
    });
  }
  if (from === to) {
    return err({
      kind: "conflict" as const,
      reason: `Das Epic steht bereits auf ${to}.`,
    });
  }
  // Ein Antrag geht immer genau einen Schritt vorwärts. Rückwärts ist kein
  // Antrag, sondern eine Korrektur — siehe `planGateRevert`.
  if (to !== nextGate(from)) {
    return err({
      kind: "hierarchy_violation" as const,
      violatedConstraint: "stage_gate_transition",
      detail:
        isValidStepTransition(from, to) && GATE_STEPS.indexOf(to) < GATE_STEPS.indexOf(from)
          ? `Rückwärts von ${from} nach ${to} ist kein Antrag, sondern eine Korrektur.`
          : `Von ${from} führt nur ein Antrag nach ${nextGate(from) ?? "— (Endgate)"}, nicht nach ${to}.`,
    });
  }
  if (hasOpenRequest) {
    return err({
      kind: "conflict" as const,
      reason: "Für dieses Epic ist bereits ein Reifegrad-Wechsel beantragt.",
    });
  }

  const readiness = gateReadiness(facts, to);
  const blocked = readinessBlockReason(readiness);
  if (blocked) {
    return err({ kind: "forbidden" as const, reason: blocked });
  }

  if (!policy.required) {
    return ok({
      from,
      to,
      quorum: policy.quorum,
      approvers: [],
      readiness,
      immediate: true,
      stamps: stampsForAdvance(facts, to, actorId, now),
    });
  }

  // Ein abnahmepflichtiges Gate ohne auflösbare Abnehmer wäre ein Antrag, auf
  // den niemand antworten kann — das Epic bliebe still stecken. Lieber jetzt
  // laut scheitern und auf die Konfiguration zeigen.
  if (approvers.length === 0) {
    return err({
      kind: "conflict" as const,
      reason: `Für den Wechsel nach ${to} ist keine abnehmende Person hinterlegt — bitte zuerst die Abnehmer des Wertstroms konfigurieren.`,
    });
  }

  return ok({
    from,
    to,
    quorum: policy.quorum,
    approvers,
    readiness,
    immediate: false,
    stamps: null,
  });
}

// ---------------------------------------------------------------------------
// Entscheidung
// ---------------------------------------------------------------------------

/** Eine Abnahme-Zeile, so weit diese Datei sie kennen muss. */
export interface GateApprovalRow {
  approverUserId: string;
  status: ApprovalStatus;
}

export type GateDecisionOutcome =
  | { kind: "still_pending"; remaining: number }
  | { kind: "advance"; from: GateStep; to: GateStep; stamps: GateStamps }
  | { kind: "rejected" };

export interface DecideGateTransitionInput {
  facts: EpicGateFacts;
  to: GateStep;
  quorum: Quorum;
  /** **Alle** Zeilen des Antrags, ohne die Entscheidung dieses Actors. */
  rows: readonly GateApprovalRow[];
  decision: ApprovalDecision;
  deciderId: string;
  comment?: string | undefined;
  now: Date;
}

/**
 * Wertet die Entscheidung eines benannten Abnehmers aus. Die Entscheidung des
 * Actors wird hier auf seine Zeile angewandt — der Aufrufer übergibt `rows` im
 * Zustand *vor* der Entscheidung, damit diese Funktion die einzige Stelle ist,
 * an der aus „ich stimme zu" ein Zeilenstatus wird.
 *
 * Eine Ablehnung stoppt den Antrag sofort, unabhängig vom Quorum: ein benannter
 * Einwand soll nicht still von einer anderen Zustimmung überstimmt werden.
 */
export function decideGateTransitionOutcome(input: DecideGateTransitionInput): GateDecisionOutcome {
  const { facts, to, quorum, rows, decision, deciderId, comment, now } = input;

  const next = rows.map((r) =>
    r.approverUserId === deciderId ? { ...r, status: decisionStatus(decision) } : r,
  );

  if (quorumRejected(next)) return { kind: "rejected" };
  if (quorumReached(next, quorum)) {
    return {
      kind: "advance",
      from: currentGateStep(facts),
      to,
      stamps: stampsForAdvance(facts, to, deciderId, now, comment),
    };
  }
  return { kind: "still_pending", remaining: pendingCount(next) };
}

// ---------------------------------------------------------------------------
// Korrektur (rückwärts)
// ---------------------------------------------------------------------------

export interface PlanGateRevertInput {
  facts: EpicGateFacts;
  to: GateStep;
  reason: string;
  now: Date;
}

/**
 * Rückwärts-Korrektur: genau ein Schritt zurück, mit Pflicht-Begründung, und die
 * Stempel des verlassenen Gates werden abgeräumt. Ein Eingriff in die Historie
 * soll begründet und vollständig sein — nicht halb.
 */
export function planGateRevert(
  input: PlanGateRevertInput,
): Result<{ from: GateStep; to: GateStep; stamps: GateStamps }> {
  const { facts, to, reason } = input;
  const from = currentGateStep(facts);

  if (reason.trim().length === 0) {
    return err({
      kind: "conflict" as const,
      reason: "Eine Rückstufung verlangt eine Begründung.",
    });
  }
  if (GATE_STEPS.indexOf(to) >= GATE_STEPS.indexOf(from)) {
    return err({
      kind: "conflict" as const,
      reason: `Eine Korrektur geht rückwärts — ${to} liegt nicht vor ${from}.`,
    });
  }
  if (!isValidStepTransition(from, to)) {
    return err({
      kind: "hierarchy_violation" as const,
      violatedConstraint: "stage_gate_transition",
      detail: `Kein Wechsel von ${from} nach ${to} — nur ein Schritt je Korrektur.`,
    });
  }

  return ok({ from, to, stamps: unwindStampsFor(from, to) });
}
