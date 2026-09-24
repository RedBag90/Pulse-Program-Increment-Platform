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
// Die Reifegrad-Leiter hat sechs Haupt-Gates (L0–L5), aber **acht** Schritte.
// Zwei davon bewegen den Reifegrad **nicht**:
//
//  - **`analysis` „Zur Analyse ausgewaehlt"** — die Entscheidung, ein Vorhaben
//    auszuarbeiten. Sie wird beantragt und abgenommen wie jeder andere Schritt,
//    aber sie ist **kein Reifegrad**: das Epic bleibt auf L1 stehen und traegt
//    danach den Stempel `selectedForAnalyzingAt`. Deshalb hat der Schritt auch
//    keine Nummer — eine Nummer waere ein Versprechen auf einen Grad, den es
//    nicht gibt.
//  - **L4.2 „Umsetzung fertig"** — „fertig gebaut" und „Nutzen nachgewiesen"
//    sind zwei Aussagen, zwischen denen viel Zeit liegen darf. Das Epic bleibt
//    auf L4 und traegt `implementationCompletedAt`.
//
// **Die Achse wurde im September 2026 neu geschnitten.** Vorher hiessen die
// Schritte L2 (zur Analyse), L3.1 (BC freigegeben) und L3.2 (Budget alloziert);
// L3 trug damit zwei Unterstufen. Jetzt ist „zur Analyse" gradlos, und was
// darauf folgt, sind zwei eigene Reifegrade: **L2 Business Case freigegeben**
// und **L3 Budget alloziert**. Die Bestandsdaten sind mitgewandert
// (`prisma/scripts/2026-09-22-reifegrad-neuschnitt.ts`).
// ---------------------------------------------------------------------------

/** Alle beantragbaren Schritte in Reihenfolge — L0 … analysis, L2, L3, L4, L4.2, L5. */
export const GATE_STEPS = ["L0", "L1", "analysis", "L2", "L3", "L4", "L4.2", "L5"] as const;
export type GateStep = (typeof GATE_STEPS)[number];

export function isGateStep(value: string): value is GateStep {
  return (GATE_STEPS as readonly string[]).includes(value);
}

/**
 * Beschriftung der **Schritte** — bewusst getrennt von `STAGE_GATE_KEYS`
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
export const GATE_STEP_KEYS: Record<GateStep, string> = {
  L0: "work.gateStep.l0",
  L1: "work.gateStep.l1",
  // Ohne Nummer, und das ist die Aussage: dieser Schritt bewegt den Reifegrad
  // nicht. Seine kurze Marke steht in {@link GATE_STEP_NUMBER_KEYS}.
  analysis: "work.gateStep.analysis",
  L2: "work.gateStep.l2",
  L3: "work.gateStep.l3",
  L4: "work.gateStep.l4",
  "L4.2": "work.gateStep.l42",
  L5: "work.gateStep.l5",
};

/**
 * Schritte **ohne** Reifegrad-Nummer — und die kurze Marke, die sie stattdessen
 * tragen.
 *
 * Ein Schritt steht hier genau dann, wenn er `stage_gate` nicht bewegt. Zwei
 * Dinge hängen daran, und beide sollen sich nie widersprechen können: er taucht
 * auf der Reifegrad-Leiter nicht auf ({@link LADDER_STEPS}), und
 * {@link gateStepNumberKey} gibt für ihn diese Marke statt einer Nummer.
 *
 * `L4.2` bewegt den Reifegrad ebenfalls nicht, steht aber **nicht** hier: es
 * trägt eine echte Nummer, unter der es am Epic auch angezeigt wird.
 */
const NUMBERLESS: readonly GateStep[] = ["analysis"];

/**
 * Die Schritte der **Reifegrad-Leiter**: `GATE_STEPS` ohne die nummernlosen.
 *
 * Nicht dasselbe wie `GATE_STEPS`, und der Unterschied ist die Aussage der
 * Leiter. `GATE_STEPS` ist der **Antrags**-Weg — jeder Schritt darauf wird
 * beantragt und abgenommen, `analysis` eingeschlossen. Die Leiter zeigt den
 * **Reifegrad**, und den bewegt `analysis` nicht. Wer beide Listen
 * gleichsetzte, schrieb einen Punkt auf die Leiter, der dort nichts misst.
 */
export const LADDER_STEPS: readonly GateStep[] = GATE_STEPS.filter(
  (step) => !NUMBERLESS.includes(step),
);

/** Katalog-Schlüssel eines Schritts; unbekannte Werte fallen auf sich selbst zurück. */
export function gateStepKey(step: string): string {
  return GATE_STEP_KEYS[step as GateStep] ?? step;
}

/**
 * Die **angezeigte Nummer** eines Schritts — `L4` heißt überall `L4.1`.
 *
 * Der gespeicherte Wert bleibt `"L4"`; das ist der Schlüssel in
 * `stage_gate_transitions`, in der v1-API und in jeder Historie. Angezeigt
 * werden darf er nie: wer ihn roh ausgibt, zeigt eine Nummer, die es am Epic
 * danach nicht gibt — genau die Verwechslung, die `GATE_STEP_KEYS` oben
 * beschreibt.
 *
 * **Eine eigene Tabelle, nicht mehr aus dem Etikett geschnitten.** Bis
 * September 2026 stand hier `label.split(" ")[0]` — das erste Wort des
 * deutschen Etiketts. Für „Zur Analyse ausgewählt" ergab das „Zur", und genau
 * das stand eine Zeit lang in der Epics-Tabelle („Wechsel nach Zur beantragt").
 * Geflickt war es mit einer Ausnahmeliste; mit der Übersetzung wäre es erneut
 * gebrochen, denn aus `"work.gateStep.l4"` lässt sich gar nichts schneiden.
 *
 * Die Nummern stehen deshalb ausgeschrieben im Katalog — auch die, die in
 * beiden Sprachen gleich lauten. Das ist Regel 1 aus ADR-0024, und hier zahlt
 * sie sich aus: `analysis` trägt keine Nummer, sondern ein Wort, und das ist in
 * derselben Tabelle nicht mehr die Ausnahme, sondern ein Eintrag wie jeder
 * andere.
 */
export const GATE_STEP_NUMBER_KEYS: Record<GateStep, string> = {
  L0: "work.gateStepNumber.l0",
  L1: "work.gateStepNumber.l1",
  analysis: "work.gateStepNumber.analysis",
  L2: "work.gateStepNumber.l2",
  L3: "work.gateStepNumber.l3",
  L4: "work.gateStepNumber.l4",
  "L4.2": "work.gateStepNumber.l42",
  L5: "work.gateStepNumber.l5",
};

export function gateStepNumberKey(step: string): string {
  return GATE_STEP_NUMBER_KEYS[step as GateStep] ?? step;
}

/** Erlaubte Schritt-Wechsel: ein Schritt vor oder zurück. */
export const GATE_STEP_TRANSITIONS: Record<GateStep, readonly GateStep[]> = {
  L0: ["L1"],
  L1: ["L0", "analysis"],
  analysis: ["L1", "L2"],
  L2: ["analysis", "L3"],
  L3: ["L2", "L4"],
  L4: ["L3", "L4.2"],
  "L4.2": ["L4", "L5"],
  L5: ["L4.2"],
};

/** True, wenn `to` ein erlaubter Nachbar-Schritt von `from` ist. */
export function isValidStepTransition(from: GateStep, to: GateStep): boolean {
  return GATE_STEP_TRANSITIONS[from].includes(to);
}

/**
 * Das Haupt-Gate, in dem ein Schritt lebt — die Spalte `Initiative.stageGate`
 * kennt nur die sechs Haupt-Gates.
 *
 * **Zwei Schritte leben in einem fremden Gate**, weil sie den Reifegrad nicht
 * bewegen: `analysis` in L1 und L4.2 in L4. Wer einen von beiden abnimmt, setzt
 * einen Stempel, keine Nummer.
 */
export function gateOfStep(step: GateStep): StageGate {
  if (step === "analysis") return "L1";
  if (step === "L4.2") return "L4";
  return step;
}

/**
 * Der Schritt, auf dem ein Epic **aktuell** steht.
 *
 * Zwei Reifegrade tragen einen zweiten Schritt, den ein Stempel aufschliesst:
 * innerhalb von **L1** entscheidet `selectedForAnalyzingAt`, ob die Analyse
 * schon beschlossen ist; innerhalb von **L4** die Bestätigung der fertigen
 * Umsetzung. Überall dort zu verwenden, wo sonst `epic.stageGate` den nächsten
 * Antrag bestimmen würde — der wäre in beiden Fällen um einen Schritt zu weit.
 */
/**
 * **Ab L3.2 ist das Geld vergeben.** „Budget alloziert" ist die
 * Investitionsentscheidung: ab hier steht ein Betrag fest, der ausgegeben
 * werden wird — und deshalb gehört das Epic in die Wirtschaftlichkeits-Rechnung
 * des Portfolios.
 *
 * Davor ist jede Zahl ein Wunsch. Das Dashboard rechnete früher mit **allem**,
 * was einen bewerteten KPI trug, und zeigte damit Kosten und Nutzen von
 * Vorhaben, über die niemand entschieden hatte.
 *
 * Nicht zu verwechseln mit `FIRST_FUNDABLE_STEP` (L2) aus Budgeting: dort
 * geht es darum, ab wann ein Epic Geld **halten darf**, hier darum, ab wann es
 * welches **bekommen hat**.
 */
export const BUDGET_DECIDED_STEP: GateStep = "L3";

/** Ist für dieses Epic die Investitionsentscheidung gefallen (L3 oder später)? */
export function hasBudgetDecision(step: GateStep): boolean {
  return GATE_STEPS.indexOf(step) >= GATE_STEPS.indexOf(BUDGET_DECIDED_STEP);
}

/**
 * Die Schwelle für Abfragen, die nur `stage_gate` kennen.
 *
 * **Seit dem Neuschnitt ist sie scharf.** Vorher lag sie *mitten* in L3: L3.1
 * und L3.2 teilten sich die Spalte, getrennt erst durch `approvedAt`. Jetzt ist
 * „Budget alloziert" ein eigener Reifegrad — wer auf L3 steht, hat Geld
 * bekommen, und eine reine Gate-Abfrage genügt.
 */
export const BUDGET_DECISION_GATE: StageGate = "L3";

export const GATES_AFTER_BUDGET_DECISION: readonly StageGate[] = STAGE_GATES.filter(
  (g) => STAGE_GATES.indexOf(g) > STAGE_GATES.indexOf(BUDGET_DECISION_GATE),
);

/**
 * **Das Lieferfenster: L3 → L4.2.**
 *
 * Vom Budget-Beschluss bis zur abgenommenen Umsetzung — die Spanne, in der an
 * einem Epic tatsächlich gearbeitet wird. Der Horizont-Trichter misst damit die
 * Größe eines Produkts, wenn das Budget-Modul aus ist: nicht wie viel Geld
 * gebunden ist, sondern wie viele Vorhaben gerade laufen.
 *
 * **L5 gehört nicht dazu.** Ein Produkt soll zeigen, woran gearbeitet wird,
 * nicht was es je geliefert hat — sonst wüchse es mit der Zeit, ohne dass
 * etwas geschieht.
 *
 * Drei Schwellen, drei Bedeutungen, leicht zu verwechseln:
 * `FIRST_FUNDABLE_STEP` (Budgeting, L2) = darf Geld halten ·
 * `BUDGET_DECIDED_STEP` (L3, nach oben offen) = hat Geld bekommen ·
 * **dieses Fenster** (L3–L4.2, geschlossen) = trägt gerade Arbeit.
 */
export const DELIVERY_LOAD_FIRST_STEP: GateStep = "L3";
export const DELIVERY_LOAD_LAST_STEP: GateStep = "L4.2";

/** Liegt der Schritt im Lieferfenster (L3 bis einschließlich L4.2)? */
export function carriesDeliveryLoad(step: GateStep): boolean {
  const i = GATE_STEPS.indexOf(step);
  return (
    i >= GATE_STEPS.indexOf(DELIVERY_LOAD_FIRST_STEP) &&
    i <= GATE_STEPS.indexOf(DELIVERY_LOAD_LAST_STEP)
  );
}

export function currentGateStep(epic: {
  stageGate: StageGate;
  /** Stempel der abgenommenen Analyse-Entscheidung — schliesst den Schritt `analysis` auf. */
  selectedForAnalyzingAt: Date | null;
  implementationCompletedAt: Date | null;
}): GateStep {
  if (epic.stageGate === "L1") return epic.selectedForAnalyzingAt != null ? "analysis" : "L1";
  if (epic.stageGate === "L4") return epic.implementationCompletedAt != null ? "L4.2" : "L4";
  return epic.stageGate;
}

/**
 * Der Schritt **L2 → L3 „Budget alloziert"** ist die Investitionsentscheidung.
 * Nur dort persistieren die Aufrufer Abnehmer, Zeitpunkt und Kommentar am Epic.
 *
 * Er hiess bis September 2026 `L3.2` und war die zweite Unterstufe von L3. Seit
 * dem Neuschnitt ist „Budget alloziert" ein eigener Reifegrad — dieselbe
 * Entscheidung, nur nicht mehr in einem fremden Gate versteckt.
 */
export function isApprovalTransition(to: GateStep): boolean {
  return to === "L3";
}

// ---------------------------------------------------------------------------
// Sub-stages — derived UI affordances within the major gates.
//
// **Nur noch eines der sechs Haupt-Gates traegt einen Split:**
//
// - **L4** splits into L4.1 "Umsetzung läuft" and L4.2 "Umsetzung fertig".
//   L4.2 wird **beantragt und abgenommen** (wie ein Gate, s. `GATE_STEPS`) und
//   materialisiert sich im Stempel `implementationCompletedAt` — früher fiel
//   das Epic automatisch auf L4.2, sobald alle Features fertig waren. „Alle
//   Features abgeschlossen" ist heute weder Automatik noch Tor, sondern ein
//   *beratender* Anhaltspunkt am Antrag; bestätigt wird per Abnahme.
//
// **L3 hatte bis September 2026 einen zweiten**: L3.1 „BC freigegeben" als
// Eintritt, L3.2 „Budget alloziert" als Entscheidung. Beide sind mit dem
// Neuschnitt zu eigenen Reifegraden geworden (L2 und L3) — der Split ist
// ersatzlos entfallen, weil er nichts mehr verbirgt.
//
// Die Ableitung liest damit nur noch einen persistierten Stempel; der Audit-Log
// der Haupt-Gates bleibt unberührt.
// ---------------------------------------------------------------------------

export const SUB_STAGES = ["L4.1", "L4.2"] as const;
export type SubStage = (typeof SUB_STAGES)[number];

/**
 * Major-Gate → seine Sub-Stages, in chronologischer Reihenfolge.
 * Genutzt von UI-Komponenten (Funnel-Bar, Reifegrad-Track) die unter dem
 * Major-Gate-Pill die Sub-Stage-Pills rendern.
 */
export const SUB_STAGES_BY_GATE: Partial<Record<StageGate, readonly SubStage[]>> = {
  L4: ["L4.1", "L4.2"],
};

export interface SubStageInput {
  stageGate: StageGate;
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
 * Pure derivation: returns the sub-stage label inside L4, or `null` for the
 * other major gates (no split there).
 */
export function subStageFor(input: SubStageInput): SubStage | null {
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
