import type { Translate } from "@/i18n/translate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { Horizon } from "@/modules/work/domain/portfolio-guardrails";
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

  /**
   * Wie viele KPI am Epic hängen, und wie viele Abhängigkeitskanten an seinen
   * Child-Features. Beide sind reine Zählungen — die Checkliste zum Business
   * Case fragt nach dem *Vorhandensein* von Inhalt, nicht nach seiner Güte.
   */
  kpiCount: number;
  dependencyCount: number;

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
   * Der Horizont der Primär-Solution und der bereits am Epic gesetzte Wert.
   * Beide gelesen, damit die L3.1-Abnahme den Horizont **einfrieren** und die
   * Rückstufung den Freeze wieder lösen kann (siehe `domain/epic-horizon.ts`).
   *
   * Für die *Reife* zählt keiner von beiden: ein Epic darf ohne Horizont durch
   * jedes Gate. Sie stehen hier, weil `stampsForAdvance` und `unwindStampsFor`
   * dieselben Fakten lesen wie die Kriterien — eine Quelle, kein zweiter Lader.
   */
  solutionHorizon: Horizon | null;
  investmentHorizon: Horizon | null;

  /**
   * Practice `multiPartyApproval`. Sie gabelt keine Kriterien mehr, sondern die
   * **Besetzung** von L3.1: an ⇒ die fünf Business-Case-Parteien zeichnen,
   * aus ⇒ der VMO allein (siehe `resolveGatePolicy`).
   */
  multiPartyApproval: boolean;

  /**
   * Ist das **Budget-Modul** freigeschaltet?
   *
   * Ohne das Modul gibt es keine Zuteilung, die ein Kriterium prüfen könnte —
   * und damit war der Schritt L3.1 → L3.2 unerreichbar: kein Epic kam je über
   * L3.1 hinaus. Das Kriterium ist die **Vorbedingung** der
   * Investitionsentscheidung, nicht die Entscheidung selbst; wo es keine Zahl
   * gibt, bleibt die Unterschrift von VMO und Finance, und die ist es, die
   * ADR-0018 verlangt.
   */
  budgetingEnabled: boolean;

  /**
   * Ist das **Drumbeat-Modul** freigeschaltet?
   *
   * Dieselbe Frage wie bei {@link budgetingEnabled}, aus demselben Grund:
   * Abhängigkeiten leben hinter Drumbeat. Ohne das Modul ist der Reiter leer,
   * und ein Kriterium darauf könnte nie grün werden — es gehört dann
   * herausgefiltert, nicht als unerfüllt gezeigt.
   */
  drumbeatEnabled: boolean;

  /**
   * Die **erwartete** Einordnung (`intendedClass`), nicht die abgeleitete.
   *
   * Vor L2 hat ein Epic gar keine Klasse — sie entsteht mit der
   * Business-Case-Freigabe aus den Kosten gegen das Portfolio-Limit. Was es
   * vorher trägt, ist die Angabe aus dem Anlege-Dialog: eine Erwartung. Das
   * L1-Kriterium fragt nach genau dieser, nicht nach der Klasse.
   */
  intendedClass: string | null;

  /**
   * Hängt dieses Epic an mindestens einem Ziel?
   *
   * Das blosse Anhängen zählt. Ein **bezifferter** Beitrag — KPI,
   * Umrechnungsfaktor, Wirkungsart — ist eine spätere Entscheidung unter einem
   * anderen Recht (`kpi.bind`); ihn hier zu verlangen hiesse, einen
   * Portfolio-Manager für einen L1-Antrag zu brauchen.
   */
  hasGoalLink: boolean;
}

/** Ein ausgewertetes Kriterium: was verlangt wird, und ob es erfüllt ist. */
export interface GateCriterion {
  key: string;
  /** Katalog-Schlüssel — die Checkliste übersetzt. */
  labelKey: string;
  /**
   * Katalog-Schlüssel des Hilfetexts: was das Kriterium bedeutet und wo/wie man
   * es erfüllt. Wird in der Checkliste per Hover/„How to" gezeigt und fließt
   * über `GATE_CRITERIA_DOC` auch in das Lifecycle-Popover.
   */
  helpKey: string;
  satisfied: boolean;
  /** Kommt in mehreren Toren vor — erfüllt wird es dann ausgeblendet. */
  recurring: boolean;
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
  /**
   * **Ein Schlüssel, keine Funktion mehr.**
   *
   * Bis September 2026 stand hier `(ctx: CriterionLabelContext) => string`:
   * das Etikett durfte von den Fakten abhängen, weil die Hypothese bei
   * eingeschalteter Mehrparteien-Freigabe „freigegeben" hiess und sonst
   * „ausgearbeitet". Dieser Fall ist längst in **zwei eigene Kriterien**
   * aufgeteilt (`hypothesis_drafted` und `hypothesis_approved`) — seitdem
   * benutzte keine der elf Regeln den Kontext noch. Übrig blieb eine
   * Funktion, die immer dasselbe zurückgab, und ein Typ, der nichts mehr
   * unterschied.
   *
   * Bräuchte ein Etikett je wieder eine Fallunterscheidung, gehört sie in den
   * Katalog (ICU `select`), nicht in den Code: sonst steht die eine Hälfte
   * der Entscheidung in `de.json` und die andere hier.
   */
  labelKey: string;
  /**
   * Katalog-Schlüssel des Hilfetexts (1–2 Sätze, Nutzersprache): Bedeutung des
   * Kriteriums plus der zuständige Reiter, in dem man es erfüllt. Bewusst
   * kontextfrei — wie {@link labelKey} soll er ohne echtes Epic erzeugbar
   * sein.
   */
  helpKey: string;
  satisfied: (facts: EpicGateFacts) => boolean;
  blocking: boolean;
  /**
   * **Kommt dieses Kriterium in mehreren Toren hintereinander vor?**
   *
   * „Epic Owner ist benannt" steht in L1, in der Analyse-Entscheidung und in
   * L2. Einmal benannt, bleibt es dauerhaft grün — und stand danach in jeder
   * Folge-Checkliste als abgehakter Punkt, der nichts mehr zu tun gab. Die
   * Anzeige blendet erfüllte wiederkehrende Kriterien deshalb aus; verliert
   * das Epic seinen Owner, stehen sie sofort wieder da.
   *
   * Bewusst **nicht** über `applies` gelöst: das bedeutet „gehört nicht zur
   * Sache", und das wäre hier falsch — der Punkt gehört sehr wohl dazu, er ist
   * nur erledigt. Und bewusst nicht für alle erfüllten Kriterien: eines, das
   * nur in *einem* Tor vorkommt, bestätigt mit seinem Haken, dass der Schritt
   * getan ist.
   */
  recurring?: boolean;
  /**
   * Wann dieses Kriterium überhaupt zur Sache gehört. Fehlt es, gilt es immer.
   *
   * Ein nicht zutreffendes Kriterium wird **herausgefiltert**, nicht als
   * erfüllt gezeigt: ein Häkchen an „Budget ist alloziert" wäre eine
   * Falschaussage, ein Kreuz, das nie grün wird, eine Sackgasse.
   */
  applies?: (facts: EpicGateFacts) => boolean;
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
  labelKey: "work.gateCriteria.hypothesisDrafted.label",
  helpKey: "work.gateCriteria.hypothesisDrafted.help",
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
  labelKey: "work.gateCriteria.hypothesisApproved.label",
  helpKey: "work.gateCriteria.hypothesisApproved.help",
  satisfied: (f) => f.hypothesisApprovedAt != null,
  blocking: true,
};

const OWNER_NOMINATED: CriterionRule = {
  key: "owner_nominated",
  labelKey: "work.gateCriteria.ownerNominated.label",
  helpKey: "work.gateCriteria.ownerNominated.help",
  // Steht in drei Toren hintereinander — siehe `recurring`.
  recurring: true,
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
/**
 * **Die erwartete Einordnung ist gesetzt.**
 *
 * Beratend, nicht blockierend: vor L2 ist sie ohnehin nur eine Erwartung, und
 * ein Epic ohne sie ist kein fehlerhaftes Epic — nur eines, bei dem niemand
 * gesagt hat, womit er rechnet. Die Abnehmer sehen die offene Stelle und
 * entscheiden.
 */
const INTENDED_CLASS_SET: CriterionRule = {
  key: "intended_class_set",
  labelKey: "work.gateCriteria.intendedClassSet.label",
  helpKey: "work.gateCriteria.intendedClassSet.help",
  satisfied: (f) => f.intendedClass != null && f.intendedClass !== "",
  blocking: false,
};

/**
 * **Das Epic zahlt auf ein Ziel ein.**
 *
 * Ein Vorhaben, das an keiner Strategie hängt, kann am Ende keinen Nutzen
 * nachweisen — die KPI-Kette beginnt an dieser Verknüpfung. Trotzdem
 * beratend: welches Ziel es ist, entscheidet sich manchmal erst beim
 * Ausarbeiten der Hypothese, und ein blockierendes Kriterium erzwänge eine
 * frühe Festlegung, die später umgehängt wird.
 */
const GOAL_LINKED: CriterionRule = {
  key: "goal_linked",
  labelKey: "work.gateCriteria.goalLinked.label",
  helpKey: "work.gateCriteria.goalLinked.help",
  satisfied: (f) => f.hasGoalLink,
  blocking: false,
};

export const GATE_CRITERIA: Partial<Record<GateStep, readonly CriterionRule[]>> = {
  L1: [HYPOTHESIS_DRAFTED, OWNER_NOMINATED, INTENDED_CLASS_SET, GOAL_LINKED],
  // Die Analyse-Entscheidung ist das Spiegelbild von L1, eine Stufe weiter:
  // dieselbe Form, der nächste Nachweis. Der Business Case steht hier
  // ausdrücklich **nicht** — dieser Schritt ist die Entscheidung, mit der
  // Analyse anzufangen, und was er auslöst, kann er nicht voraussetzen. Bis
  // September 2026 stand er als beratender Punkt dabei; er blockierte
  // niemanden, sah aber wie eine Aufgabe aus und drehte die Reihenfolge um.
  analysis: [HYPOTHESIS_APPROVED, OWNER_NOMINATED],
  // L2 — die Business-Case-Freigabe. Dieser Schritt *ist* sie, deshalb kann er
  // sie nicht voraussetzen; verlangt wird der ausgearbeitete Inhalt. Das Geld
  // ist der Schritt danach.
  L2: [
    {
      key: "business_case_drafted",
      labelKey: "work.gateCriteria.businessCaseDrafted.label",
      helpKey: "work.gateCriteria.businessCaseDrafted.help",
      satisfied: (f) => f.hasBusinessCaseContent,
      blocking: true,
    },
    // Die drei Reiter, die auf derselben Stufe erarbeitet werden. Sie standen
    // bis September 2026 nirgends auf dieser Liste — wer sie pflegen sollte,
    // erfuhr es an der Tor-Karte nicht. Alle drei sind **beratend**: sie zeigen
    // den Stand, halten aber niemanden auf. Blockierend bleibt allein der
    // ausgearbeitete Business Case, denn nur ihn gibt dieser Schritt frei.
    {
      key: "deliverables_drafted",
      labelKey: "work.gateCriteria.deliverablesDrafted.label",
      helpKey: "work.gateCriteria.deliverablesDrafted.help",
      satisfied: (f) => f.childFeatureStats.total > 0,
      blocking: false,
    },
    {
      key: "dependencies_mapped",
      labelKey: "work.gateCriteria.dependenciesMapped.label",
      helpKey: "work.gateCriteria.dependenciesMapped.help",
      // **Bewusste Unschärfe, und sie gehört benannt:** ein Epic ohne
      // Abhängigkeiten ist ein gültiger Zustand, den keine Zählung von „noch
      // nicht angeschaut" unterscheidet. Dort bleibt der Kreis offen. Weil das
      // Kriterium beratend ist, ist das ein Hinweis und keine Sackgasse.
      satisfied: (f) => f.dependencyCount > 0,
      blocking: false,
      // **Kein `applies` mehr.** Bis September 2026 stand hier
      // `(f) => f.drumbeatEnabled`, mit der Begründung „ohne Drumbeat gibt es
      // den Reiter nicht". Das stimmte, solange Abhängigkeiten Drumbeat waren;
      // seit `dependency.` zu `work` gehört (`kernel/domain/modules.ts`), ist
      // der Reiter da, und das Kriterium gehört zur Sache. Der Filter war eine
      // Folge der Modulgrenze, nicht des Kriteriums — und er hat es aus der
      // L2-Liste verschwinden lassen, ohne dass jemand danach gesucht hätte.
    },
    {
      key: "kpis_defined",
      labelKey: "work.gateCriteria.kpisDefined.label",
      helpKey: "work.gateCriteria.kpisDefined.help",
      satisfied: (f) => f.kpiCount > 0,
      blocking: false,
    },
    OWNER_NOMINATED,
  ],
  // L3 „Budget alloziert" — die Investitionsentscheidung. Sie ist ein eigener
  // beantragter Schritt, damit sie nicht als Nebenwirkung einer Budgetzuteilung
  // entsteht (ADR-0018, Festlegung 1). Bis September 2026 hiess sie L3.2.
  L3: [
    {
      key: "budget_allocated",
      labelKey: "work.gateCriteria.budgetAllocated.label",
      helpKey: "work.gateCriteria.budgetAllocated.help",
      satisfied: (f) => f.budgetAllocationSum > 0,
      blocking: true,
      // Nur dort, wo es ein Budget gibt. Ohne das Modul trägt den Schritt die
      // Unterschrift allein — siehe `budgetingEnabled` an den Fakten.
      applies: (f) => f.budgetingEnabled,
    },
  ],
  L4: [
    {
      // Beratend, nicht blockierend: der Antrag *ist* der bewusste Start der
      // Umsetzung. Früher war L3→L4 explizit „manuell ohne Vorbedingung
      // erlaubt" — dieselbe Entscheidung, jetzt sichtbar statt kommentiert.
      key: "feature_started",
      labelKey: "work.gateCriteria.featureStarted.label",
      helpKey: "work.gateCriteria.featureStarted.help",
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
      labelKey: "work.gateCriteria.featuresCompleted.label",
      helpKey: "work.gateCriteria.featuresCompleted.help",
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
      labelKey: "work.gateCriteria.implementationConfirmed.label",
      helpKey: "work.gateCriteria.implementationConfirmed.help",
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
  const rules = (GATE_CRITERIA[to] ?? []).filter((rule) => rule.applies?.(facts) ?? true);
  const criteria = rules.map((rule) => ({
    key: rule.key,
    labelKey: rule.labelKey,
    helpKey: rule.helpKey,
    satisfied: rule.satisfied(facts),
    blocking: rule.blocking,
    recurring: rule.recurring ?? false,
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
export function readinessBlockReason(readiness: GateReadiness, t: Translate): string | null {
  const missing = readiness.criteria.filter((c) => c.blocking && !c.satisfied);
  if (missing.length === 0) return null;
  return t("work.gate.blockReason", {
    gate: readiness.to,
    criteria: missing.map((c) => t(c.labelKey)).join("; "),
  });
}
