import { GATE_STEPS, type GateStep } from "@/modules/work/domain/stage-gate";
import { mayHoldAllocation } from "@/modules/budgeting/domain/allocation-eligibility";

/**
 * **Was ein Epic auf einem Reifegrad-Schritt haben darf.**
 *
 * Das Gegenstück zu `seed-gate-history.ts`: dort der **Weg** (welcher Schritt
 * welchen Stempel setzt), hier der **Inhalt** (welches Feld ab wann überhaupt
 * dasteht).
 *
 * Die Trennung war die Wurzel eines stillen Fehlers. Die Faltung in
 * `seed-gate-history` leitet `stageGate` und alle Stempel sauber aus einer
 * Zugfolge ab — ob ein Feld am Epic *steht*, entschied dagegen jeder Aufrufer
 * für sich, und zwar mit drei verstreuten Prädikaten:
 *
 * ```
 * seed-demo.ts    def.gate === "L2" || … || "L5"   → businessCase
 * seed-large.ts   ["L2","L3","L4","L5"].includes   → costToMvp, helpRequested
 * seed-large.ts   gate !== "L0"                    → benefitHypothesis
 * ```
 *
 * Die Timeline stand in keinem davon. Ergebnis im Bestand: 28 von 30
 * Funnel-Ideen wussten bereits, dass sie am 30.09.2026 beginnen und am
 * 27.02.2027 fertig sind — dazu KPIs, Solutions und in zwei Fällen Features.
 *
 * **Der Maßstab ist das Anlege-Formular.** Was `createEpicAction` entgegennimmt
 * (`src/modules/work/features/portfolio/actions/epic.ts`), ist die Definition
 * von L0: Titel, Beschreibung, Wertstrom, ART, Primär-Solution, Klasse — plus
 * die Ziel-Verknüpfung, die der Dialog in einem zweiten Schritt setzt. Nichts
 * sonst; `createEpic` schreibt nicht einmal einen Owner.
 *
 * Rein, kein I/O — wie `allocation-eligibility.ts`, dem diese Datei ihr Muster
 * verdankt.
 */

/**
 * Die **Stempel stehen hier nicht drin.** `hypothesisApprovedAt`,
 * `selectedFor*At`, `businessCaseApprovedAt`, `implementation*At`,
 * `impactRecognizedAt`, `approvedAt` und `needsSteeringAttention` kommen allein
 * aus `stampsForAdvance` über `buildGateHistory`. Sie hier zu wiederholen wäre
 * genau die zweite Wahrheit, die diese Datei abschafft.
 */
/**
 * **Warum `investmentHorizon` hier fehlt.** Es ist kein Inhalt, der mit dem
 * Reifegrad entsteht. Ein Vorhaben ohne Primär-Solution — in H3 gibt es keine
 * (ADR-0020) — trägt seinen Horizont *selbst*, und zwar von Anfang an: das Feld
 * vertritt dort die Solution, die das Anlege-Formular sehr wohl kennt. Was bei
 * L3.1 passiert, ist das **Einfrieren** des abgeleiteten Werts, und dafür ist
 * `stampsForAdvance` zuständig, nicht diese Tabelle.
 *
 * Der erste Anlauf hatte es auf L3.1 geschoben — der Seed scheiterte prompt an
 * seiner eigenen Invariante: 21 Forschungs-Epics standen ohne Horizont da.
 */
export interface GateContent {
  /** Ausgearbeitete Hypothese. Ihr Inhalt ist die Vorleistung für den Schritt →L1. */
  benefitHypothesis: boolean;
  /**
   * `timeline.estimates` — und die daraus abgeleiteten
   * `plannedStartAt`/`plannedEndAt`. Die **Actuals** setzt die Faltung an ihren
   * eigenen Toren (`backlog` bei L3.2, `implementation` bei L4.2).
   */
  timeline: boolean;
  /** Lean Business Case, in Arbeit. Freigegeben wird er mit dem Schritt →L3.1. */
  businessCase: boolean;
  costToMvp: boolean;
  /** Epic oder Enabler — nicht Teil des Anlege-Formulars. */
  epicType: boolean;
  kpis: boolean;
  /** Child-Features. Der Schnitt entsteht beim Ausarbeiten des Business Case. */
  features: boolean;
  /** Abgeleitet — nicht wiederholt. Siehe `mayHoldAllocation`. */
  budget: boolean;
  themeLink: boolean;
  /** Abhängigkeiten zwischen Epics (Rollout-Bögen). */
  epicDependency: boolean;
  issues: boolean;
  helpRequested: boolean;
  stagedForBudgeting: boolean;
}

/**
 * Ab welchem Schritt ein Feld erlaubt ist. Ein Feld, das hier fehlt, gehört
 * nach L0 — also in die Menge, die schon das Anlege-Formular kennt.
 *
 * **Die Analyse-Entscheidung ist die Schwelle, hinter der ein Epic „in Arbeit"
 * ist.** Danach wird der
 * Business Case ausgearbeitet, und dafür braucht es die Zahlen (KPIs,
 * `costToMvp`), den Schnitt (Features), die Einordnung (`epicType`, Theme) und
 * die Reibung (Issues, Abhängigkeiten, Hilferufe). Vorher ist das Vorhaben
 * eine Idee mit einer Vermutung.
 */
const EARLIEST: Record<keyof GateContent, GateStep> = {
  benefitHypothesis: "L1",
  timeline: "L1",
  businessCase: "analysis",
  costToMvp: "analysis",
  epicType: "analysis",
  kpis: "analysis",
  features: "analysis",
  themeLink: "analysis",
  epicDependency: "analysis",
  issues: "analysis",
  helpRequested: "analysis",
  stagedForBudgeting: "analysis",
  // Unbenutzt: `budget` haengt an `mayHoldAllocation`, siehe unten.
  budget: "L2",
};

const atLeast = (step: GateStep, floor: GateStep): boolean =>
  GATE_STEPS.indexOf(step) >= GATE_STEPS.indexOf(floor);

/** Was auf diesem Schritt dastehen darf. Monoton: ein späterer Schritt erlaubt nie weniger. */
export function contentForGate(step: GateStep): GateContent {
  return {
    benefitHypothesis: atLeast(step, EARLIEST.benefitHypothesis),
    timeline: atLeast(step, EARLIEST.timeline),
    businessCase: atLeast(step, EARLIEST.businessCase),
    costToMvp: atLeast(step, EARLIEST.costToMvp),
    epicType: atLeast(step, EARLIEST.epicType),
    kpis: atLeast(step, EARLIEST.kpis),
    features: atLeast(step, EARLIEST.features),
    // Nicht `atLeast(step, "L2")`: die Budget-Schwelle gehört dem
    // Budgeting-Modul, und zwei Fassungen derselben Zahl laufen auseinander.
    budget: mayHoldAllocation(step),
    themeLink: atLeast(step, EARLIEST.themeLink),
    epicDependency: atLeast(step, EARLIEST.epicDependency),
    issues: atLeast(step, EARLIEST.issues),
    helpRequested: atLeast(step, EARLIEST.helpRequested),
    stagedForBudgeting: atLeast(step, EARLIEST.stagedForBudgeting),
  };
}

/** Ein Epic, so weit die Regel es kennen muss. */
export interface EpicContentFacts {
  id: string;
  title: string;
  step: GateStep;
  /** Welche Inhalte tatsächlich geschrieben wurden. */
  has: Partial<Record<keyof GateContent, boolean>>;
}

export interface ContentViolation {
  id: string;
  title: string;
  step: GateStep;
  field: keyof GateContent;
  reason: string;
}

/** Wie das Feld in einer Fehlermeldung heißt. */
const LABEL: Record<keyof GateContent, string> = {
  benefitHypothesis: "eine Hypothese",
  timeline: "eine Timeline",
  businessCase: "einen Business Case",
  costToMvp: "einen MVP-Richtwert",
  epicType: "einen Epic-Typ",
  kpis: "KPIs",
  features: "Features",
  budget: "Budget",
  themeLink: "eine Theme-Verknüpfung",
  epicDependency: "eine Epic-Abhängigkeit",
  issues: "Issues",
  helpRequested: "einen Hilferuf",
  stagedForBudgeting: "eine Budget-Vormerkung",
};

/**
 * Die Verstöße, mit Namen — damit ein Seed **laut** scheitert statt still
 * falsche Daten zu schreiben, so wie `assertGateHistory` es für den Weg und
 * `allocationRuleViolations` es für das Geld tut.
 */
export function gateContentViolations(epics: readonly EpicContentFacts[]): ContentViolation[] {
  const out: ContentViolation[] = [];
  for (const e of epics) {
    const allowed = contentForGate(e.step);
    for (const key of Object.keys(LABEL) as (keyof GateContent)[]) {
      if (e.has[key] && !allowed[key]) {
        out.push({
          id: e.id,
          title: e.title,
          step: e.step,
          field: key,
          reason: `hat ${LABEL[key]}, steht aber erst auf ${e.step} — das gibt es erst ab ${EARLIEST[key]}`,
        });
      }
    }
  }
  return out;
}

/** Die Verstöße als lesbarer Block — für die Ausgabe eines scheiternden Seeds. */
export function formatContentViolations(violations: readonly ContentViolation[]): string {
  return violations.map((v) => `  · „${v.title}" ${v.reason}`).join("\n");
}

/** Wirft, sobald ein Epic mehr trägt, als sein Schritt erlaubt. */
export function assertGateContent(epics: readonly EpicContentFacts[]): void {
  const violations = gateContentViolations(epics);
  if (violations.length === 0) return;
  throw new Error(
    `Seed verletzt den Prozess — ${violations.length} Epic(s) tragen Inhalt, den ihr Reifegrad nicht hergibt:\n` +
      formatContentViolations(violations),
  );
}
