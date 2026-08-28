import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES, allChildrenCompleted } from "@/modules/work/domain/stage-gate";

// ---------------------------------------------------------------------------
// Gate-Readiness — „ist dieses Epic reif für den nächsten Reifegrad?"
//
// Das ist der Nachfolger der alten `TRIGGER_RULES`. Der entscheidende
// Unterschied ist nicht die Form, sondern die Richtung:
//
//   FRÜHER: ein Save in `budgeting.ts` / `feature.ts` / `epic.ts` *schrieb*
//           `proposedStageGate` in die Initiative-Zeile. Der Zustand lag in
//           einem Slot, der hinter der Wirklichkeit zurückfallen konnte —
//           daher die Backstop-Aufrufe, die Stale-Prüfung beim Bestätigen und
//           die Cross-Modul-Schreibkopplung.
//
//   JETZT:  niemand schreibt. Readiness wird beim *Lesen* aus dem abgeleitet,
//           was ohnehin persistiert ist. Kein Slot ⇒ nichts kann veralten,
//           kein fremdes Modul muss in Work-Spalten schreiben.
//
// Readiness ist ausserdem **nicht** die Erlaubnis. Sie beschreibt nur, ob die
// inhaltliche Vorleistung da ist; geschoben wird trotzdem erst durch einen
// Antrag plus die namentlichen Abnahmen (siehe `gate-transition.ts`).
//
// Rein, kein I/O, keine Uhr.
// ---------------------------------------------------------------------------

/** Aggregierte Zahlen über die Child-Features eines Epics. */
export interface ChildFeatureStats {
  total: number;
  started: number;
  completed: number;
}

/**
 * Alles, was Readiness über ein Epic lesen darf — vom Adapter in einem Durchlauf
 * materialisiert. Gegenüber dem alten `EpicGateState` fehlen bewusst zwei
 * Felder: `actorId` (Readiness kennt keinen Handelnden) und `proposedStageGate`
 * (es gibt keinen Slot mehr).
 */
export interface EpicGateFacts {
  stageGate: StageGate;
  ownerId: string | null;

  // Inhaltliche Signale.
  hypothesisApprovedAt: Date | null;
  hasHypothesisContent: boolean;
  hasBusinessCaseContent: boolean;
  businessCaseApprovedAt: Date | null;
  budgetAllocationSum: number;
  childFeatureStats: ChildFeatureStats;

  // Bereits gesetzte Stempel — gelesen, damit `stampsForAdvance` nicht doppelt
  // stempelt.
  selectedForDetailingAt: Date | null;
  selectedForAnalyzingAt: Date | null;
  implementationStartedAt: Date | null;
  approvedAt: Date | null;
  impactRecognizedAt: Date | null;

  /** Practice `multiPartyApproval` — gabelt die Hypothese-Kriterien. */
  multiPartyApproval: boolean;
}

/** Ein ausgewertetes Kriterium: was verlangt wird, und ob es erfüllt ist. */
export interface GateCriterion {
  key: string;
  /** Nutzersprache, Deutsch — wird 1:1 in der Checkliste gerendert. */
  label: string;
  /**
   * Hilfetext in Nutzersprache: was das Kriterium bedeutet und wo/wie man es
   * erfüllt. Wird in der Checkliste per Hover/„How to" gezeigt und fließt über
   * `GATE_CRITERIA_DOC` auch in das Lifecycle-Popover.
   */
  help: string;
  satisfied: boolean;
  /**
   * `true` = verhindert den Antrag. `false` = beratend: die Checkliste zeigt
   * das Kriterium, blockiert aber nicht.
   *
   * Dieses eine Flag ersetzt die frühere, willkürliche Zweiteilung zwischen
   * `BLOCKED_MANUAL_TRANSITIONS` (L2→L3, L4→L5 gar nicht manuell erreichbar)
   * und `manualForwardBlockReason` (L0→L1, L1→L2 mit Vorbedingung) — zwei
   * Mechanismen für dieselbe Frage, in zwei Dateien.
   */
  blocking: boolean;
}

/** Die Kriterien-Auswertung für genau einen Übergang. */
export interface GateReadiness {
  from: StageGate;
  to: StageGate;
  criteria: GateCriterion[];
  /** Alle **blockierenden** Kriterien erfüllt. */
  ready: boolean;
}

/** Was die Beschriftung eines Kriteriums beeinflusst. */
export type CriterionLabelContext = Pick<EpicGateFacts, "multiPartyApproval">;

/**
 * Statische Regel: ein Kriterium, bevor es gegen Fakten ausgewertet wurde.
 *
 * `label` nimmt bewusst nur {@link CriterionLabelContext}, nicht die vollen
 * Fakten: so kann der Doku-Katalog (`epic-lifecycle-doc.ts`) die Beschriftungen
 * ohne ein echtes Epic erzeugen, ohne dafür einen Cast zu brauchen.
 */
export interface CriterionRule {
  key: string;
  label: (ctx: CriterionLabelContext) => string;
  /**
   * Statischer Hilfetext (1–2 Sätze, Nutzersprache): Bedeutung des Kriteriums
   * plus der zuständige Reiter, in dem man es erfüllt. Bewusst kontextfrei —
   * wie {@link label} soll er ohne echtes Epic erzeugbar sein.
   */
  help: string;
  satisfied: (facts: EpicGateFacts) => boolean;
  blocking: boolean;
}

/**
 * L0→L1 und L1→L2 verlangen dieselbe Vorleistung: eine freigegebene (bzw. bei
 * ausgeschalteter Mehrparteien-Freigabe: ausgearbeitete) Benefit-Hypothese.
 * L2 ist der *Eintritt* in die Analyse und steht damit vor „Business Case
 * fertig" — der BC-Inhalt ist Voraussetzung fürs BC-Einreichen, nicht hier.
 */
const HYPOTHESIS_READY: CriterionRule = {
  key: "hypothesis_ready",
  label: (f) =>
    f.multiPartyApproval
      ? "Benefit-Hypothese ist freigegeben"
      : "Benefit-Hypothese ist ausgearbeitet",
  help:
    "Die Benefit-Hypothese beschreibt den erwarteten Nutzen und die Annahme dahinter. " +
    "Formuliere sie im Reiter Hypothese; ist die Mehrparteien-Freigabe aktiv, muss sie " +
    "dort zusätzlich freigegeben werden, sonst genügt ausgearbeiteter Inhalt.",
  satisfied: (f) =>
    f.multiPartyApproval ? f.hypothesisApprovedAt != null : f.hasHypothesisContent,
  blocking: true,
};

const OWNER_NOMINATED: CriterionRule = {
  key: "owner_nominated",
  label: () => "Epic Owner ist benannt",
  help:
    "Der Epic Owner verantwortet Fortschritt, Business Case und Freigaben. " +
    "Benenne ihn im Overview über das Owner-Feld.",
  satisfied: (f) => f.ownerId != null,
  blocking: false,
};

/**
 * Die Kriterien je **Ziel**-Gate. Inhaltlich sind das die Prädikate der alten
 * `TRIGGER_RULES` plus die Guards aus `manualForwardBlockReason` — an einer
 * Stelle statt an dreien.
 *
 * L0 hat keinen Eintrag: dorthin führt kein Vorwärts-Antrag (nur ein Revert,
 * der eigene Regeln hat).
 */
export const GATE_CRITERIA: Partial<Record<StageGate, readonly CriterionRule[]>> = {
  L1: [HYPOTHESIS_READY, OWNER_NOMINATED],
  L2: [
    HYPOTHESIS_READY,
    OWNER_NOMINATED,
    {
      key: "business_case_started",
      label: () => "Business Case ist begonnen",
      help:
        "Der Business Case hält Kosten, Nutzen und Optionen fest. Begonnen heißt: " +
        "es gibt bereits Inhalt. Pflege ihn im Reiter Business Case.",
      satisfied: (f) => f.hasBusinessCaseContent,
      blocking: false,
    },
  ],
  L3: [
    {
      key: "business_case_approved",
      label: () => "Business Case ist freigegeben",
      help:
        "Der Business Case ist von den benannten Personen abgenommen. Fordere die " +
        "Freigabe im Reiter Business Case an.",
      satisfied: (f) => f.businessCaseApprovedAt != null,
      blocking: true,
    },
    {
      key: "budget_allocated",
      label: () => "Budget ist alloziert (Σ > 0)",
      help:
        "Dem Epic ist über das Participatory Budgeting Budget zugeteilt (Summe > 0). " +
        "Die Zuteilung erfolgt in den Budgeting-Zeiträumen.",
      satisfied: (f) => f.budgetAllocationSum > 0,
      blocking: true,
    },
  ],
  L4: [
    {
      // Beratend, nicht blockierend: der Antrag *ist* der bewusste Start der
      // Umsetzung. Früher war L3→L4 explizit „manuell ohne Vorbedingung
      // erlaubt" — dieselbe Entscheidung, jetzt sichtbar statt kommentiert.
      key: "feature_started",
      label: () => "Mindestens ein Feature ist gestartet",
      help:
        "Mindestens ein untergeordnetes Feature ist in Umsetzung. Features entstehen " +
        "im Reiter Deliverables; ihr Status wird im Delivery-Cockpit gesetzt.",
      satisfied: (f) => f.childFeatureStats.started > 0,
      blocking: false,
    },
  ],
  L5: [
    {
      key: "features_completed",
      label: () => "Alle Child-Features sind abgeschlossen",
      help:
        "Alle untergeordneten Features sind abgeschlossen — Voraussetzung für den " +
        "Abschluss des Epics (L5). Den Feature-Status pflegst du im Delivery-Cockpit.",
      satisfied: (f) => allChildrenCompleted(f.childFeatureStats),
      blocking: true,
    },
  ],
};

/** Das Gate nach `from`, oder `null` am Endgate L5. */
export function nextGate(from: StageGate): StageGate | null {
  const i = STAGE_GATES.indexOf(from);
  return i >= 0 && i < STAGE_GATES.length - 1 ? (STAGE_GATES[i + 1] as StageGate) : null;
}

/** Das Gate vor `from`, oder `null` am Startgate L0. */
export function previousGate(from: StageGate): StageGate | null {
  const i = STAGE_GATES.indexOf(from);
  return i > 0 ? (STAGE_GATES[i - 1] as StageGate) : null;
}

/**
 * Wertet die Kriterien für `facts.stageGate → to` aus. Ein Ziel-Gate ohne
 * Kriterien (z. B. L0) ist trivial bereit — die *Erlaubnis* prüft
 * `planGateRequest`, nicht diese Funktion.
 */
export function gateReadiness(facts: EpicGateFacts, to: StageGate): GateReadiness {
  const rules = GATE_CRITERIA[to] ?? [];
  const criteria = rules.map((rule) => ({
    key: rule.key,
    label: rule.label(facts),
    help: rule.help,
    satisfied: rule.satisfied(facts),
    blocking: rule.blocking,
  }));
  return {
    from: facts.stageGate,
    to,
    criteria,
    ready: criteria.every((c) => !c.blocking || c.satisfied),
  };
}

/**
 * Der Grund, warum ein Antrag blockiert ist — vorformuliert, damit weder Service
 * noch UI die Botschaft neu erfinden. `null`, wenn nichts blockiert.
 */
export function readinessBlockReason(readiness: GateReadiness): string | null {
  const missing = readiness.criteria.filter((c) => c.blocking && !c.satisfied);
  if (missing.length === 0) return null;
  return `Reifegrad ${readiness.to} verlangt: ${missing.map((c) => c.label).join("; ")}.`;
}
