import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES, type GateStep, type SubStage } from "@/modules/work/domain/stage-gate";

/**
 * Der Weg eines Epics als **acht Prozessabschnitte, getrennt durch acht Tore**.
 *
 * Kanban und Reifegrad zeigen Verschiedenes: das Kanban den *Prozess*
 * („Hypothese ausarbeiten"), der Reifegrad die *Meilensteine* („Hypothese
 * freigegeben"). Diese Liste hält beides auseinander und in einem Eintrag
 * zusammen: der **Abschnitt** sagt, woran gearbeitet wird und wo das Epic
 * dabei steht; das **Tor** am Ende sagt, was erreicht ist, wenn es die Schwelle
 * überschreitet.
 *
 * Bis September 2026 waren es neun gleichartige Schritte, und zwei davon —
 * „Selected for Detailing" und „Business hypothesis done" — waren zwei Namen
 * für dasselbe Tor (→L1): ein Rest aus der Zeit vor der Acht-Schritt-Leiter.
 * Der Behelf dafür hieß `foldedMarker` und ist mit dem Neuschnitt weggefallen.
 */
export interface LifecycleStepMeta {
  /**
   * Schlüssel des Abschnitts — **zugleich** der Schlüssel des Schätzfelds
   * seines Tores (`TIMELINE_ESTIMATE_PHASES`). Acht Abschnitte, acht Felder;
   * deshalb kommt der Neuschnitt ohne Datenwanderung aus.
   */
  key: string;
  /** Reifegrad, auf dem das Epic **während** dieses Abschnitts steht. */
  gate: StageGate;
  /** Der Prozess — was hier getan wird. Katalog-Schlüssel. */
  labelKey: string;
  descriptionKey: string;
  /** Das Tor, das diesen Abschnitt schließt. */
  milestone: {
    labelKey: string;
    /** Wer zeichnet. */
    approverKey: string;
    /**
     * Der Reifegrad-Schritt, den die Abnahme vollzieht. `null` heißt: dieses
     * Tor bewegt den Reifegrad **nicht** — es gibt genau eines davon, die
     * Erstsichtung, die durch die Benennung des Epic Owners erreicht wird.
     */
    step: GateStep | null;
  };
}

export const LIFECYCLE_STEPS: readonly LifecycleStepMeta[] = [
  {
    key: "detailing",
    gate: "L0",
    labelKey: "work.lifecycle.detailing.label",
    descriptionKey: "work.lifecycle.detailing.description",
    milestone: {
      labelKey: "work.lifecycle.detailing.milestoneLabel",
      approverKey: "work.lifecycle.detailing.milestoneApprover",
      step: null,
    },
  },
  {
    key: "hypothesis",
    gate: "L0",
    labelKey: "work.lifecycle.hypothesis.label",
    descriptionKey: "work.lifecycle.hypothesis.description",
    milestone: {
      labelKey: "work.lifecycle.hypothesis.milestoneLabel",
      approverKey: "work.lifecycle.hypothesis.milestoneApprover",
      step: "L1",
    },
  },
  {
    key: "analyzing",
    gate: "L1",
    labelKey: "work.lifecycle.analyzing.label",
    descriptionKey: "work.lifecycle.analyzing.description",
    // Der einzige Meilenstein neben der Erstsichtung, der den Reifegrad nicht
    // bewegt — er wird aber beantragt und abgenommen, anders als jene.
    milestone: {
      labelKey: "work.lifecycle.analyzing.milestoneLabel",
      approverKey: "work.lifecycle.analyzing.milestoneApprover",
      step: "analysis",
    },
  },
  {
    key: "business_case",
    // Das Epic steht waehrend der Ausarbeitung noch auf L1 — die Analyse ist
    // beschlossen, der Business Case noch nicht freigegeben.
    gate: "L1",
    labelKey: "work.lifecycle.businessCase.label",
    descriptionKey: "work.lifecycle.businessCase.description",
    milestone: {
      labelKey: "work.lifecycle.businessCase.milestoneLabel",
      approverKey: "work.lifecycle.businessCase.milestoneApprover",
      step: "L2",
    },
  },
  {
    key: "backlog",
    gate: "L2",
    labelKey: "work.lifecycle.backlog.label",
    descriptionKey: "work.lifecycle.backlog.description",
    milestone: {
      labelKey: "work.lifecycle.backlog.milestoneLabel",
      approverKey: "work.lifecycle.backlog.milestoneApprover",
      step: "L3",
    },
  },
  {
    key: "implementation_started",
    gate: "L3",
    labelKey: "work.lifecycle.implementationStarted.label",
    descriptionKey: "work.lifecycle.implementationStarted.description",
    milestone: {
      labelKey: "work.lifecycle.implementationStarted.milestoneLabel",
      approverKey: "work.lifecycle.implementationStarted.milestoneApprover",
      step: "L4",
    },
  },
  {
    key: "implementation",
    gate: "L4",
    labelKey: "work.lifecycle.implementation.label",
    descriptionKey: "work.lifecycle.implementation.description",
    milestone: {
      labelKey: "work.lifecycle.implementation.milestoneLabel",
      approverKey: "work.lifecycle.implementation.milestoneApprover",
      step: "L4.2",
    },
  },
  {
    key: "done",
    gate: "L4",
    labelKey: "work.lifecycle.done.label",
    descriptionKey: "work.lifecycle.done.description",
    milestone: {
      labelKey: "work.lifecycle.done.milestoneLabel",
      approverKey: "work.lifecycle.done.milestoneApprover",
      step: "L5",
    },
  },
];

export type LifecycleStepStatus = "done" | "current" | "upcoming";

export interface LifecycleStep extends LifecycleStepMeta {
  /** Der Abschnitt: `current` heißt „hier wird gerade gearbeitet". */
  status: LifecycleStepStatus;
  /** Das Tor am Ende: `current` heißt „das nächste offene Tor". */
  milestoneStatus: LifecycleStepStatus;
}

/**
 * Stage-Gate-Sicht auf ein Epic — die Fakten, aus denen sich ergibt, welche
 * Tore erreicht sind. Bewusst dieselbe Achse wie `epicNextStep`, damit
 * Zeitleiste, Stepper und „Nächster Schritt" nie auseinanderlaufen.
 */
export interface EpicLifecycleInput {
  stageGate: StageGate;
  /** subStageFor(): L4.2 = Umsetzung abgenommen. Nur L4 traegt noch einen Split. */
  subStage: SubStage | null;
  impactRecognizedAt: Date | null;
  /**
   * Stempel der Erstsichtung (gesetzt beim **ersten** Benennen des Owners).
   * Sie bewegt den Reifegrad nicht, ist also aus `stageGate` allein nicht
   * ablesbar — solange das Epic in L0 steht, ist dieses Feld die einzige
   * Auskunft darüber, ob sie stattgefunden hat.
   */
  selectedForDetailingAt: Date | null;
  /**
   * Stempel der abgenommenen Analyse-Entscheidung. Aus demselben Grund nötig:
   * „Zur Analyse ausgewählt" ist seit dem Neuschnitt ein Gate **ohne**
   * Reifegrad — auf L1 ist dieses Feld die einzige Auskunft darüber, ob der
   * Schritt schon gegangen ist.
   */
  selectedForAnalyzingAt: Date | null;
}

/** Welche der acht Tore sind erreicht? Reihenfolge wie `LIFECYCLE_STEPS`. */
function gatesReached(input: EpicLifecycleInput): boolean[] {
  const {
    stageGate,
    subStage,
    impactRecognizedAt,
    selectedForDetailingAt,
    selectedForAnalyzingAt,
  } = input;
  const gi = STAGE_GATES.indexOf(stageGate);

  // Endzustand — wie `epicNextStep` kurzschließt: ist der Impact bestätigt oder
  // das Epic auf L5, ist alles erreicht. Ohne das entstünde aus einem bestätigten
  // Impact bei niedrigerem Reifegrad ein widersprüchlicher Zwischenzustand.
  if (impactRecognizedAt != null || gi >= 5) return LIFECYCLE_STEPS.map(() => true);

  return [
    gi >= 1 || selectedForDetailingAt != null, // Erstsichtung
    gi >= 1, // L1 · Hypothese freigegeben
    // „Zur Analyse ausgewaehlt" bewegt den Reifegrad nicht — erreicht ist der
    // Meilenstein, sobald der Stempel steht oder das Epic darueber hinaus ist.
    gi >= 2 || selectedForAnalyzingAt != null,
    gi >= 2, // L2 · Business Case freigegeben
    gi >= 3, // L3 · Budget alloziert
    gi >= 4, // L4.1 · Umsetzung gestartet
    gi > 4 || (gi === 4 && subStage === "L4.2"), // L4.2 · Umsetzung fertig
    gi >= 5, // L5 · Impact realisiert (der Endzustand ist oben abgefangen)
  ];
}

/**
 * Der Zustand jedes Abschnitts **und** seines Tores.
 *
 * Genau ein Abschnitt läuft — der erste, dessen Tor noch offen ist —, und genau
 * sein Tor ist das nächste. Alles davor ist erledigt, alles dahinter künftig.
 * Ist das letzte Tor erreicht, läuft nichts mehr.
 */
export function epicLifecycleSteps(input: EpicLifecycleInput): LifecycleStep[] {
  const reached = gatesReached(input);
  const running = reached.indexOf(false);

  return LIFECYCLE_STEPS.map((step, i) => ({
    ...step,
    status: reached[i] ? "done" : i === running ? "current" : "upcoming",
    milestoneStatus: reached[i] ? "done" : i === running ? "current" : "upcoming",
  }));
}

/** Der Index des laufenden Abschnitts, oder `null`, wenn alles erreicht ist. */
export function runningStepIndex(input: EpicLifecycleInput): number | null {
  const i = gatesReached(input).indexOf(false);
  return i === -1 ? null : i;
}

export interface LifecycleSpan {
  /** Beginn; `null`, wenn davor ein Ist-Datum fehlt. */
  from: Date | null;
  /** Ende; `null`, solange das Tor offen ist und der Abschnitt nicht läuft. */
  to: Date | null;
  /** Ganze Tage — `null`, wenn sich keine ehrliche Dauer bilden lässt. */
  days: number | null;
  /** Läuft dieser Abschnitt gerade? Dann zählt er bis heute. */
  running: boolean;
}

const DAY = 86_400_000;

/**
 * Die Dauern — **rein abgeleitet, ohne ein einziges neues Feld.**
 *
 * Ein Abschnitt beginnt, wenn das **vorige** Tor erreicht wurde; der erste
 * beginnt mit dem Anlegen des Epics. Er endet an seinem eigenen Tor — oder,
 * solange das offen ist und er der laufende Abschnitt ist, heute.
 *
 * Fehlt in der Kette ein Ist-Datum, entfällt die Dauer, statt eine falsche zu
 * behaupten: lieber keine Zahl als eine erfundene.
 */
export function lifecycleSpans(input: {
  createdAt: Date;
  /** Ist-Datum je Tor, in der Reihenfolge von `LIFECYCLE_STEPS`. */
  gateActuals: readonly (Date | null)[];
  runningIndex: number | null;
  now: Date;
}): LifecycleSpan[] {
  const { createdAt, gateActuals, runningIndex, now } = input;
  return LIFECYCLE_STEPS.map((_step, i) => {
    const from = i === 0 ? createdAt : (gateActuals[i - 1] ?? null);
    const running = i === runningIndex;
    const to = gateActuals[i] ?? (running ? now : null);
    const days = from && to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY)) : null;
    return { from, to: gateActuals[i] ?? null, days, running };
  });
}

/**
 * **Die Spalten des Portfolio-Kanbans.**
 *
 * Sie entstanden bis September 2026 aus `STAGE_GATES` × `STAGE_SHORT_KEYS` — Spalte
 * und Reifegrad waren dasselbe. Mit dem Neuschnitt der Achse traegt das nicht
 * mehr: zwei Reifegrade teilen sich eine Spalte, zwei Spalten unterscheiden
 * sich nur durch einen Stempel, und der letzte Grad steht gar nicht mehr auf
 * dem Board. Eine Liste, die man lesen kann, ist darum ehrlicher als eine
 * Ableitung, die man erklaeren muss.
 */
export const PORTFOLIO_COLUMNS = [
  "funnel",
  "hypothesis",
  "business_case",
  "investment",
  "implementation",
  "impact",
] as const;
export type PortfolioColumn = (typeof PORTFOLIO_COLUMNS)[number];

export const PORTFOLIO_COLUMN_LABELS: Record<PortfolioColumn, string> = {
  funnel: "Funnel",
  hypothesis: "Hypothese",
  business_case: "Business Case",
  investment: "Investition",
  implementation: "Umsetzung",
  impact: "Impact",
};

/**
 * Die **Kanban-Spalte** eines Epics — das Kanban zeigt den Prozess, nicht den
 * Reifegrad.
 *
 * **Drei Stempel entscheiden mit, nicht nur der Grad.** Zwei Meilensteine
 * bewegen den Reifegrad per Definition nicht — die Erstsichtung auf L0 und die
 * Analyse-Entscheidung auf L1 —, und ohne sie waere die halbe Bewegung des
 * Boards unsichtbar:
 *
 * ```
 * Funnel         L0, ungesichtet
 * Hypothese      L0 mit Owner · L1 ohne Analyse-Entscheidung
 * Business Case  L1 mit Analyse-Entscheidung
 * Investition    L2 (BC freigegeben) · L3 (Budget alloziert)
 * Umsetzung      L4, noch nicht fertig gemeldet
 * Impact         L4, fertig gemeldet (L4.2)
 * ```
 *
 * **L5 steht auf keiner Spalte.** Ein Board zeigt, woran gearbeitet wird; ein
 * Epic mit bestaetigtem Impact ist fertig und wuerde die Spalte nur noch fuellen.
 * Deshalb `null` — der Aufrufer laesst es weg.
 *
 * Das ist bewusst **nicht** die alte Bucket-Abweichung, die mit ADR-0018
 * entfallen ist: die glich aus, dass ein Gate der Wirklichkeit hinterherlief.
 * Hier laeuft nichts hinterher — die beiden Meilensteine sind gradlos gemeint.
 *
 * Der Reifegrad-Balken zaehlt weiterhin nach `stageGate`: eine Flaeche fuer den
 * Prozess, eine fuer die Reifegrade.
 *
 * Rein, kein I/O.
 */
export function processColumn(epic: {
  stageGate: string;
  selectedForDetailingAt: Date | null;
  selectedForAnalyzingAt: Date | null;
  implementationCompletedAt: Date | null;
}): PortfolioColumn | null {
  switch (epic.stageGate) {
    case "L0":
      return epic.selectedForDetailingAt != null ? "hypothesis" : "funnel";
    case "L1":
      return epic.selectedForAnalyzingAt != null ? "business_case" : "hypothesis";
    case "L2":
    case "L3":
      return "investment";
    case "L4":
      return epic.implementationCompletedAt != null ? "impact" : "implementation";
    default:
      // L5 — und alles, was die Spalte nicht kennt.
      return null;
  }
}
