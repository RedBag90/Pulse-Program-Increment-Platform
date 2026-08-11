import type { StageGate } from "@/modules/core/kernel/domain/types";

/**
 * The ordered lifecycle an Epic traverses — the 9 phases the "Nächster Schritt"
 * guidance drives it through (the fine-grained expansion of the L0–L5 gates). Each
 * step carries a static **Erklärung** so the whole process is explicit and readable
 * from the start; the per-Epic status (done/current/upcoming) is derived from the
 * milestone timestamps (see `epicLifecycleSteps`, mirroring `epic-timeline-tab`).
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

/** Milestone signals per step; each non-null/truthy value marks its step complete. */
export interface EpicLifecycleInput {
  selectedForDetailingAt: Date | null;
  hypothesisApprovedAt: Date | null;
  selectedForAnalyzingAt: Date | null;
  businessCaseApprovedAt: Date | null;
  /** timeline.actuals.backlog (owner-entered manual date). */
  backlogActual: string | null | undefined;
  implementationStartedAt: Date | null;
  /** timeline.actuals.implementation (owner-entered manual date). */
  implementationActual: string | null | undefined;
  impactRecognizedAt: Date | null;
}

/**
 * Resolve each lifecycle step's status. `current` is the first step whose signal
 * is absent; earlier steps are `done`, later steps `upcoming`. Mirrors the
 * `actualPresent`/`statusAt` logic in `epic-timeline-tab.tsx`.
 */
export function epicLifecycleSteps(input: EpicLifecycleInput): LifecycleStep[] {
  const actualPresent = [
    true, // funnel — createdAt is always set
    Boolean(input.selectedForDetailingAt),
    Boolean(input.hypothesisApprovedAt),
    Boolean(input.selectedForAnalyzingAt),
    Boolean(input.businessCaseApprovedAt),
    Boolean(input.backlogActual),
    Boolean(input.implementationStartedAt),
    Boolean(input.implementationActual),
    Boolean(input.impactRecognizedAt),
  ];
  const firstOpen = actualPresent.indexOf(false);
  return LIFECYCLE_STEPS.map((step, i) => ({
    ...step,
    status: actualPresent[i] ? "done" : i === firstOpen ? "current" : "upcoming",
  }));
}
