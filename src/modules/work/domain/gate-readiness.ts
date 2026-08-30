import type { StageGate } from "@/modules/core/kernel/domain/types";
import {
  GATE_STEPS,
  allChildrenCompleted,
  currentGateStep,
  type GateStep,
} from "@/modules/work/domain/stage-gate";

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
  /** Abgenommene L4.2-Bestätigung — trägt zugleich den Schritt innerhalb von L4. */
  implementationCompletedAt: Date | null;
  approvedAt: Date | null;
  impactRecognizedAt: Date | null;

  /**
   * Practice `multiPartyApproval`. Sie gabelt keine Kriterien mehr, sondern die
   * **Besetzung** von L3.1: an ⇒ die fünf Business-Case-Parteien zeichnen,
   * aus ⇒ der VMO allein (siehe `resolveGatePolicy`).
   */
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
  from: GateStep;
  to: GateStep;
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
 * Vorleistung für **L0 → L1**: ausgearbeiteter Inhalt, nicht die Freigabe.
 *
 * Die Abnahme dieses Schritts *ist* die Hypothesen-Freigabe — sie hier zur
 * Voraussetzung zu machen wäre zirkulär. Deshalb hängt das Kriterium am Inhalt
 * und kennt keine `multiPartyApproval`-Gabelung mehr.
 */
const HYPOTHESIS_DRAFTED: CriterionRule = {
  key: "hypothesis_drafted",
  label: () => "Benefit-Hypothese ist ausgearbeitet",
  help:
    "Die Benefit-Hypothese beschreibt den erwarteten Nutzen und die Annahme dahinter. " +
    "Formuliere sie im Reiter Hypothese. Freigegeben wird sie mit der Abnahme dieses " +
    "Schritts — einen eigenen Freigabelauf davor gibt es nicht.",
  satisfied: (f) => f.hasHypothesisContent,
  blocking: true,
};

/**
 * Vorleistung für **L1 → L2**: die abgenommene Hypothese. Nach dem Umbau ist das
 * gleichbedeutend mit „L1 wurde abgenommen" — geprüft wird aber die Tatsache
 * (der Stempel), nicht die Spalte.
 */
const HYPOTHESIS_APPROVED: CriterionRule = {
  key: "hypothesis_approved",
  label: () => "Benefit-Hypothese ist freigegeben",
  help:
    "Die Hypothese wurde mit dem Schritt auf L1 abgenommen. Fehlt der Stempel, ist " +
    "das Epic nie sauber durch L1 gegangen.",
  satisfied: (f) => f.hypothesisApprovedAt != null,
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
export const GATE_CRITERIA: Partial<Record<GateStep, readonly CriterionRule[]>> = {
  L1: [HYPOTHESIS_DRAFTED, OWNER_NOMINATED],
  L2: [
    HYPOTHESIS_APPROVED,
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
  // L3.1 — der Eintritt in „Investition". Dieser Schritt *ist* die
  // Business-Case-Freigabe, deshalb kann er sie nicht voraussetzen; verlangt
  // wird der ausgearbeitete Inhalt. Das Geld ist der Schritt danach.
  "L3.1": [
    {
      key: "business_case_drafted",
      label: () => "Business Case ist ausgearbeitet",
      help:
        "Der Business Case hält Kosten, Nutzen und Optionen fest. Pflege ihn im " +
        "Reiter Business Case. Freigegeben wird er mit der Abnahme dieses Schritts " +
        "durch die fünf Parteien — einen eigenen Freigabelauf davor gibt es nicht.",
      satisfied: (f) => f.hasBusinessCaseContent,
      blocking: true,
    },
    OWNER_NOMINATED,
  ],
  // L3.2 „Budget alloziert" — die Investitionsentscheidung. Sie ist ein eigener
  // beantragter Schritt, damit sie nicht als Nebenwirkung einer Budgetzuteilung
  // entsteht (ADR-0018, Festlegung 1).
  "L3.2": [
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
  // L4.2 „Umsetzung fertig" — der beantragte Abschluss der Umsetzung.
  "L4.2": [
    {
      // Beratend, nicht blockierend — dieselbe Begründung wie bei
      // `feature_started`: „fertig gebaut" ist eine Aussage, die die abnehmende
      // Person trifft, nicht eine, die aus einer Zählung entsteht (ADR-0018,
      // Festlegung 1). Der Feature-Zähler ist ihr Anhaltspunkt, nicht das Tor —
      // ein Rest-Feature, das bewusst offen bleibt, darf den Abschluss nicht
      // aufhalten. Hart bleibt dafür `implementation_confirmed` bei L5.
      key: "features_completed",
      label: () => "Alle Child-Features sind abgeschlossen",
      help:
        "Alle untergeordneten Features sind abgeschlossen — der übliche Anhaltspunkt " +
        "dafür, dass die Umsetzung fertig ist. Die Bestätigung trifft die Abnahme, " +
        "nicht der Zähler. Den Feature-Status pflegst du im Delivery-Cockpit.",
      satisfied: (f) => allChildrenCompleted(f.childFeatureStats),
      blocking: false,
    },
  ],
  L5: [
    {
      // L4.2 ≠ L5: „fertig gebaut" ist nicht „Nutzen nachgewiesen" — zwischen
      // beidem darf beliebig viel Zeit liegen. Der Impact-Antrag setzt die
      // bestätigte Umsetzung voraus, ersetzt sie aber nicht.
      key: "implementation_confirmed",
      label: () => "Umsetzung ist als abgeschlossen bestätigt (L4.2)",
      help:
        "Der Abschluss der Umsetzung wurde beantragt und abgenommen (Schritt L4.2). " +
        "Erst danach lässt sich der realisierte Impact bestätigen (L5).",
      satisfied: (f) => f.implementationCompletedAt != null,
      blocking: true,
    },
  ],
};

/** Der Schritt nach `from`, oder `null` am Endschritt L5. */
export function nextGate(from: GateStep): GateStep | null {
  const i = GATE_STEPS.indexOf(from);
  return i >= 0 && i < GATE_STEPS.length - 1 ? (GATE_STEPS[i + 1] as GateStep) : null;
}

/** Der Schritt vor `from`, oder `null` am Startschritt L0. */
export function previousGate(from: GateStep): GateStep | null {
  const i = GATE_STEPS.indexOf(from);
  return i > 0 ? (GATE_STEPS[i - 1] as GateStep) : null;
}

/**
 * Wertet die Kriterien für `facts.stageGate → to` aus. Ein Ziel-Gate ohne
 * Kriterien (z. B. L0) ist trivial bereit — die *Erlaubnis* prüft
 * `planGateRequest`, nicht diese Funktion.
 */
export function gateReadiness(facts: EpicGateFacts, to: GateStep): GateReadiness {
  const rules = GATE_CRITERIA[to] ?? [];
  const criteria = rules.map((rule) => ({
    key: rule.key,
    label: rule.label(facts),
    help: rule.help,
    satisfied: rule.satisfied(facts),
    blocking: rule.blocking,
  }));
  return {
    from: currentGateStep(facts),
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
