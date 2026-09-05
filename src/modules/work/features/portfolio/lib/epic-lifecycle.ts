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
  /** Der Prozess — was hier getan wird. */
  label: string;
  description: string;
  /** Das Tor, das diesen Abschnitt schließt. */
  milestone: {
    label: string;
    /** Wer zeichnet. */
    approver: string;
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
    label: "Idee erfasst",
    description: "Epic im Funnel angelegt, wartet auf Sichtung.",
    milestone: {
      label: "Erstsichtung",
      approver: "Der VMO sichtet das Epic und benennt den Epic Owner",
      step: null,
    },
  },
  {
    key: "hypothesis",
    gate: "L0",
    label: "Hypothese ausarbeiten",
    description: "Problem, Zielgruppe, erwarteter Nutzen, Leading Indicators.",
    milestone: {
      label: "L1 · Hypothese freigegeben",
      approver: "VMO — die Abnahme ist zugleich die Freigabe",
      step: "L1",
    },
  },
  {
    key: "analyzing",
    gate: "L1",
    label: "Für die Analyse einplanen",
    description: "Der Wertstrom entscheidet, was Aufwand bekommt.",
    milestone: { label: "L2 · Zur Analyse ausgewählt", approver: "VMO", step: "L2" },
  },
  {
    key: "business_case",
    gate: "L2",
    label: "Business Case ausarbeiten",
    description: "Lean Business Case erstellen und zur Freigabe stellen.",
    milestone: {
      label: "L3.1 · Business Case freigegeben",
      approver: "MGMT · Business Owner · Finance · IRT · VMO · Produkt-Manager",
      step: "L3.1",
    },
  },
  {
    key: "backlog",
    gate: "L3",
    label: "Budget zuteilen",
    description: "Die Investitionsentscheidung vorbereiten.",
    milestone: {
      label: "L3.2 · Budget alloziert",
      approver: "VMO und Finance",
      step: "L3.2",
    },
  },
  {
    key: "implementation_started",
    gate: "L3",
    label: "Umsetzung starten",
    description: "Erstes Feature auf den Weg bringen.",
    milestone: {
      label: "L4.1 · Umsetzung gestartet",
      approver: "VMO — plus Produkt-Manager bei ART-Epics",
      step: "L4",
    },
  },
  {
    key: "implementation",
    gate: "L4",
    label: "Umsetzen",
    description: "Features liefern, bis das Vorhaben steht.",
    milestone: { label: "L4.2 · Umsetzung fertig", approver: "VMO", step: "L4.2" },
  },
  {
    key: "done",
    gate: "L4",
    label: "Nutzen messen",
    description: "Wirkt das Vorhaben wie versprochen?",
    milestone: { label: "L5 · Impact realisiert", approver: "Finance", step: "L5" },
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
  /** subStageFor(): L3.2 = Investition abgenommen, L4.2 = Umsetzung abgenommen. */
  subStage: SubStage | null;
  impactRecognizedAt: Date | null;
  /**
   * Stempel der Erstsichtung (gesetzt beim **ersten** Benennen des Owners).
   * Sie bewegt den Reifegrad nicht, ist also aus `stageGate` allein nicht
   * ablesbar — solange das Epic in L0 steht, ist dieses Feld die einzige
   * Auskunft darüber, ob sie stattgefunden hat.
   */
  selectedForDetailingAt: Date | null;
}

/** Welche der acht Tore sind erreicht? Reihenfolge wie `LIFECYCLE_STEPS`. */
function gatesReached(input: EpicLifecycleInput): boolean[] {
  const { stageGate, subStage, impactRecognizedAt, selectedForDetailingAt } = input;
  const gi = STAGE_GATES.indexOf(stageGate);

  // Endzustand — wie `epicNextStep` kurzschließt: ist der Impact bestätigt oder
  // das Epic auf L5, ist alles erreicht. Ohne das entstünde aus einem bestätigten
  // Impact bei niedrigerem Reifegrad ein widersprüchlicher Zwischenzustand.
  if (impactRecognizedAt != null || gi >= 5) return LIFECYCLE_STEPS.map(() => true);

  return [
    gi >= 1 || selectedForDetailingAt != null, // Erstsichtung
    gi >= 1, // L1 · Hypothese freigegeben
    gi >= 2, // L2 · Zur Analyse ausgewählt
    gi >= 3, // L3.1 · Business Case freigegeben — der Eintritt in L3 *ist* die Freigabe
    gi > 3 || (gi === 3 && subStage === "L3.2"), // L3.2 · Budget alloziert
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
 * Die **Kanban-Spalte** eines Epics — das Kanban zeigt den Prozess, nicht den
 * Reifegrad.
 *
 * Für fünf der sechs Spalten fällt beides zusammen. Nur `L0` zerfällt: solange
 * das Epic ungesichtet im Funnel liegt, steht es in **Funnel**; sobald der VMO
 * es gesichtet und den Owner benannt hat, wird an der **Hypothese** gearbeitet —
 * und genau das soll die Spalte zeigen, obwohl der Reifegrad noch `L0` ist.
 *
 * Das ist bewusst **nicht** die alte Bucket-Abweichung, die mit ADR-0018
 * entfallen ist: die glich aus, dass ein Gate der Wirklichkeit hinterherlief.
 * Hier läuft nichts hinterher — die Erstsichtung ist ein Meilenstein, der den
 * Reifegrad **per Definition** nicht bewegt, und ohne diese Regel wäre er im
 * Kanban unsichtbar.
 *
 * Der Reifegrad-Balken zählt weiterhin nach `stageGate`: eine Fläche für den
 * Prozess, eine für die Meilensteine.
 *
 * Rein, kein I/O.
 */
export function processColumn(epic: {
  stageGate: string;
  selectedForDetailingAt: Date | null;
}): string {
  return epic.stageGate === "L0" && epic.selectedForDetailingAt != null ? "L1" : epic.stageGate;
}
