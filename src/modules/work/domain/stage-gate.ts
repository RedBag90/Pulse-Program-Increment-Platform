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
// Die Reifegrad-Leiter hat sechs Haupt-Gates (L0–L5), aber **acht** Schritte:
// zwei Haupt-Gates tragen einen zweiten beantragbaren Schritt.
//
//  - **L3.2 „Budget alloziert"** — L3 wird mit der freigegebenen Business-Case-
//    Freigabe betreten (Schritt **L3.1**); die Investitionsentscheidung selbst
//    ist der Schritt danach. „Wir haben einen Business Case" und „wir geben Geld" sind
//    zwei Aussagen, und die zweite darf nicht als Nebenwirkung einer
//    Budgetzuteilung entstehen.
//  - **L4.2 „Umsetzung fertig"** — „fertig gebaut" und „Nutzen nachgewiesen"
//    sind zwei Aussagen, zwischen denen viel Zeit liegen darf.
//
// Beide sind keine Haupt-Gates: `Initiative.stageGate` bleibt auf „L3" bzw.
// „L4" stehen, die Bestätigung materialisiert sich in einem Stempel
// (`approvedAt` bzw. `implementationCompletedAt`). Der Schritt-Typ existiert nur
// im Antrags-/Abnahme-Apparat (Policies, Kriterien, Historie).
// ---------------------------------------------------------------------------

/** Alle beantragbaren Schritte in Reihenfolge — L0 … L3.1, L3.2, L4, L4.2, L5. */
export const GATE_STEPS = ["L0", "L1", "L2", "L3.1", "L3.2", "L4", "L4.2", "L5"] as const;
export type GateStep = (typeof GATE_STEPS)[number];

export function isGateStep(value: string): value is GateStep {
  return (GATE_STEPS as readonly string[]).includes(value);
}

/**
 * Beschriftung der **Schritte** — bewusst getrennt von `STAGE_GATE_LABELS`
 * (`src/components/detail/initiative-labels.ts`), das dieselben Schlüssel für
 * die **Major-Gates** benutzt.
 *
 * Der Unterschied fällt an genau einer Stelle auf: `L4` heißt als Major-Gate
 * „L4 Implementierung", weil es beide Unterstufen umfasst (Trichter-Leiste,
 * Epics-Tabelle, Cockpit). Als **Schritt** meint dasselbe `L4` den Eintritt in
 * die Umsetzung — und der steht danach als `L4.1` am Epic. Wer ihn beantragte,
 * las vorher „L4" und hinterher „L4.1" und musste selbst schließen, dass das
 * dieselbe Sache ist.
 *
 * Der **gespeicherte Wert bleibt `"L4"`**: dies ist eine Beschriftung, kein
 * neuer Schritt. `GATE_STEPS`, `stage_gate_transitions.toGate` und die v1-API
 * sind unberührt.
 */
export const GATE_STEP_LABELS: Record<GateStep, string> = {
  L0: "L0 Idee",
  L1: "L1 Hypothese definiert",
  L2: "L2 Business Case",
  "L3.1": "L3.1 BC freigegeben",
  "L3.2": "L3.2 Budget alloziert",
  L4: "L4.1 Umsetzung läuft",
  "L4.2": "L4.2 Umsetzung fertig",
  L5: "L5 Impact realisiert",
};

/** Beschriftung eines Schritts; unbekannte Werte fallen auf sich selbst zurück. */
export function gateStepLabel(step: string): string {
  return GATE_STEP_LABELS[step as GateStep] ?? step;
}

/** Erlaubte Schritt-Wechsel: ein Schritt vor oder zurück. */
export const GATE_STEP_TRANSITIONS: Record<GateStep, readonly GateStep[]> = {
  L0: ["L1"],
  L1: ["L0", "L2"],
  L2: ["L1", "L3.1"],
  "L3.1": ["L2", "L3.2"],
  "L3.2": ["L3.1", "L4"],
  L4: ["L3.2", "L4.2"],
  "L4.2": ["L4", "L5"],
  L5: ["L4.2"],
};

/** True, wenn `to` ein erlaubter Nachbar-Schritt von `from` ist. */
export function isValidStepTransition(from: GateStep, to: GateStep): boolean {
  return GATE_STEP_TRANSITIONS[from].includes(to);
}

/**
 * Das Haupt-Gate, in dem ein Schritt lebt. L3 traegt beide L3.x-Schritte, L4
 * beide L4.x — die Spalte `Initiative.stageGate` kennt nur die sechs Haupt-Gates.
 */
export function gateOfStep(step: GateStep): StageGate {
  if (step === "L3.1" || step === "L3.2") return "L3";
  if (step === "L4.2") return "L4";
  return step;
}

/**
 * Der Schritt, auf dem ein Epic **aktuell** steht: innerhalb von L3 entscheidet
 * die Investitionsfreigabe (`approvedAt`), innerhalb von L4 die Bestätigung der
 * fertigen Umsetzung, ob das Epic schon auf dem zweiten Schritt steht. Überall
 * dort zu verwenden, wo bisher `epic.stageGate` den nächsten Antrag bestimmt hat.
 */
export function currentGateStep(epic: {
  stageGate: StageGate;
  approvedAt: Date | null;
  implementationCompletedAt: Date | null;
}): GateStep {
  if (epic.stageGate === "L3") return epic.approvedAt != null ? "L3.2" : "L3.1";
  if (epic.stageGate === "L4") return epic.implementationCompletedAt != null ? "L4.2" : "L4";
  return epic.stageGate;
}

/**
 * Der Schritt **L3.1 → L3.2 „Budget alloziert"** ist die Investitionsentscheidung.
 * Nur dort persistieren die Aufrufer Abnehmer, Zeitpunkt und Kommentar am Epic.
 *
 * Frueher hing das am Erreichen des Haupt-Gates L3. Mit dem Neuschnitt betritt
 * ein Epic L3 bereits mit der freigegebenen Business-Case-Freigabe (L3.1) — die
 * Geldentscheidung faellt erst einen Schritt spaeter.
 */
export function isApprovalTransition(to: GateStep): boolean {
  return to === "L3.2";
}

// ---------------------------------------------------------------------------
// Sub-stages — derived UI affordances within the major gates.
//
// Two of the six major gates carry an internally meaningful split:
//
// - **L3** splits into L3.1 "Business Case freigegeben" (der Eintritt) and
//   L3.2 "Budget alloziert". L3.2 wird **beantragt und abgenommen** (s.
//   `GATE_STEPS`) und materialisiert sich im Stempel `approvedAt`.
//
// - **L4** splits into L4.1 "Umsetzung läuft" and L4.2 "Umsetzung fertig".
//   L4.2 wird **beantragt und abgenommen** (wie ein Gate, s. `GATE_STEPS`) und
//   materialisiert sich im Stempel `implementationCompletedAt` — früher fiel
//   das Epic automatisch auf L4.2, sobald alle Features fertig waren. „Alle
//   Features abgeschlossen" ist heute weder Automatik noch Tor, sondern ein
//   *beratender* Anhaltspunkt am Antrag; bestätigt wird per Abnahme.
//
// Die Ableitung liest damit nur noch persistierte Fakten (BC-Stempel,
// Bestätigungs-Stempel); der Audit-Log der Haupt-Gates bleibt unberührt.
// ---------------------------------------------------------------------------

export const SUB_STAGES = ["L3.1", "L3.2", "L4.1", "L4.2"] as const;
export type SubStage = (typeof SUB_STAGES)[number];

/**
 * Major-Gate → seine Sub-Stages, in chronologischer Reihenfolge.
 * Genutzt von UI-Komponenten (Funnel-Bar, Reifegrad-Track) die unter dem
 * Major-Gate-Pill die Sub-Stage-Pills rendern.
 */
export const SUB_STAGES_BY_GATE: Partial<Record<StageGate, readonly SubStage[]>> = {
  L3: ["L3.1", "L3.2"],
  L4: ["L4.1", "L4.2"],
};

export interface SubStageInput {
  stageGate: StageGate;
  /** Stempel der abgenommenen L3.2-Investitionsentscheidung („Budget alloziert"). */
  approvedAt: Date | null;
  /** Stempel der abgenommenen L4.2-Bestätigung („Umsetzung fertig"). */
  implementationCompletedAt: Date | null;
}

/**
 * The single "all child features completed" rule — der **beratende**
 * Anhaltspunkt des L4.2-Antrags (Kriterium `features_completed`). Sie bestätigt
 * die fertige Umsetzung nicht und hält den Antrag auch nicht auf; beides tut
 * die Abnahme.
 */
export function allChildrenCompleted(stats: { total: number; completed: number }): boolean {
  return stats.total > 0 && stats.completed === stats.total;
}

/**
 * Pure derivation: returns the sub-stage label inside L2 or L4, or `null`
 * for the other major gates (no split there).
 */
export function subStageFor(input: SubStageInput): SubStage | null {
  if (input.stageGate === "L3") {
    // Investition abgenommen (L3→L3.2) ⇒ L3.2, sonst steht das Epic auf dem
    // Eintritt L3.1 („Business Case freigegeben").
    return input.approvedAt != null ? "L3.2" : "L3.1";
  }
  if (input.stageGate === "L4") {
    // Bestätigt (abgenommener L4→L4.2-Antrag) ⇒ L4.2, sonst läuft die Umsetzung.
    return input.implementationCompletedAt != null ? "L4.2" : "L4.1";
  }
  // L2 traegt keinen Split mehr: auf L2 zu stehen *ist* „Business Case in Arbeit".
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
