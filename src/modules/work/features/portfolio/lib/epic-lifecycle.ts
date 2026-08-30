import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES, type SubStage } from "@/modules/work/domain/stage-gate";

/**
 * The ordered lifecycle an Epic traverses — the 9 phases the "Nächster Schritt"
 * guidance drives it through (the fine-grained expansion of the L0–L5 gates). Each
 * step carries a static **Erklärung** so the whole process is explicit and readable
 * from the start; the per-Epic status (done/current/upcoming) is derived from the
 * **Stage Gate** (+ subStage / child-features) — the same axis as
 * `epic-next-step.ts`, so the highlighted tile always matches the "Nächster Schritt".
 */
export interface LifecycleStepMeta {
  key: string;
  gate: StageGate;
  label: string;
  description: string;
}

export const LIFECYCLE_STEPS: readonly LifecycleStepMeta[] = [
  { key: "funnel", gate: "L0", label: "Funnel", description: "Epic als Idee im Funnel erfasst." },
  {
    key: "detailing",
    gate: "L1",
    label: "Detailing",
    description: "Zur Ausarbeitung ausgewählt, Owner nominiert.",
  },
  {
    key: "hypothesis",
    gate: "L1",
    label: "Hypothese",
    description: "Benefit-Hypothese formuliert und freigegeben.",
  },
  {
    key: "analyzing",
    gate: "L2",
    label: "Analyse",
    description: "Epic zur Analyse ausgewählt.",
  },
  {
    key: "business_case",
    gate: "L2",
    label: "Business Case",
    description: "Lean Business Case erstellt und freigegeben.",
  },
  {
    key: "backlog",
    gate: "L3",
    label: "Backlog",
    description: "Budget alloziert, Aufnahme ins Portfolio-Backlog.",
  },
  {
    key: "implementation_started",
    gate: "L4",
    label: "Umsetzung ▸ Start",
    description: "Umsetzung gestartet (erstes Feature).",
  },
  {
    key: "implementation",
    gate: "L4",
    label: "Umsetzung ▸ Fertig",
    description: "Alle Features abgeschlossen.",
  },
  {
    key: "done",
    gate: "L5",
    label: "Impact",
    description: "Impact durch Controlling bestätigt.",
  },
];

export type LifecycleStepStatus = "done" | "current" | "upcoming";

export interface LifecycleStep extends LifecycleStepMeta {
  status: LifecycleStepStatus;
}

/**
 * Stage-Gate view of an Epic — the exact inputs `epicNextStep` reads. Deriving the
 * step status from these (not milestone timestamps) keeps the highlighted tile and
 * the embedded "Nächster Schritt" coherent even when the gate was advanced without
 * stamping every intermediate milestone.
 */
export interface EpicLifecycleInput {
  stageGate: StageGate;
  /** subStageFor(): L3.2 = Investition abgenommen, L4.2 = Umsetzung abgenommen. */
  subStage: SubStage | null;
  impactRecognizedAt: Date | null;
}

/**
 * Resolve each lifecycle step's status. A step is `reached` once the Stage Gate
 * (+ subStage / child-features) has passed it; `current` is the
 * first not-reached step, earlier steps are `done`, later steps `upcoming`. The
 * thresholds are chosen so `current` lands on exactly the step `epicNextStep`
 * addresses — the two selection markers (Detailing, Analyse) fold into their gate
 * and never hold the highlight (they carry no distinct next-action).
 */
export function epicLifecycleSteps(input: EpicLifecycleInput): LifecycleStep[] {
  const { stageGate, subStage, impactRecognizedAt } = input;
  const gi = STAGE_GATES.indexOf(stageGate);

  // Terminal (mirrors `epicNextStep`'s `impactRecognizedAt || L5` short-circuit):
  // the Epic is done, every step greyed, no highlight.
  if (impactRecognizedAt != null || gi >= 5) {
    return LIFECYCLE_STEPS.map((step) => ({ ...step, status: "done" }));
  }

  const reached = [
    true, // funnel
    true, // detailing — folded selection marker
    gi >= 1, // hypothesis — approved ⇒ L1
    gi >= 1, // analyzing — folded selection marker
    gi >= 3, // business_case — der Eintritt in L3.1 *ist* die BC-Freigabe
    gi >= 4, // backlog — impl started ⇒ left backlog
    gi >= 5 || subStage === "L4.2", // implementation_started — L4.2 ist abgenommen
    gi >= 5, // implementation — alle Features fertig
    impactRecognizedAt != null || gi >= 5, // done
  ];
  const firstOpen = reached.indexOf(false);
  return LIFECYCLE_STEPS.map((step, i) => ({
    ...step,
    status: firstOpen === -1 || i < firstOpen ? "done" : i === firstOpen ? "current" : "upcoming",
  }));
}
