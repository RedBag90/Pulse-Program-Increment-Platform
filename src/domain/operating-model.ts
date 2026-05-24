/**
 * The target operating model vocabulary — the practices an organisation may
 * switch on, and the starter templates management picks from. Pure, no I/O.
 *
 * The practice flags are the *master switch for complexity*: only the parts of
 * SAFe a tenant's target enables ever surface in the UI. SAFe is the vocabulary
 * here, not a mandate — a "team_level" target turns almost everything off.
 */

export const PRACTICES = [
  "portfolioLevel",
  "programLevel",
  "stageGates",
  "wsjf",
  "multiPartyApproval",
  "featureQs",
  "dependencies",
  "piObjectives",
] as const;

export type Practice = (typeof PRACTICES)[number];

/** Which practices the target operating model has switched on. */
export type PracticeFlags = Record<Practice, boolean>;

/** Structure goals; `null` means "not part of the target". */
export interface StructureTargets {
  targetValueStreams: number | null;
  targetArtsTotal: number | null;
  targetTeamsTotal: number | null;
  targetPiCadenceWeeks: number | null;
}

/** When no target model is defined yet, everything is on (today's behaviour). */
export const DEFAULT_PRACTICES: PracticeFlags = {
  portfolioLevel: true,
  programLevel: true,
  stageGates: true,
  wsjf: true,
  multiPartyApproval: true,
  featureQs: true,
  dependencies: true,
  piObjectives: true,
};

/** Short German labels for the configurator + glossary. */
export const PRACTICE_LABELS: Record<Practice, string> = {
  portfolioLevel: "Portfolio-Ebene (Wertströme, Epics)",
  programLevel: "Programm-Ebene (ARTs, PIs, Features)",
  stageGates: "Stage Gates (Investment-Funnel L0–L5)",
  wsjf: "WSJF-Priorisierung",
  multiPartyApproval: "Mehrparteien-Freigabe für Epics",
  featureQs: "Feature-QS",
  dependencies: "Abhängigkeiten",
  piObjectives: "PI-Ziele",
};

export const OPERATING_MODEL_TEMPLATES = [
  "team_level",
  "essential_safe",
  "portfolio_safe",
  "custom",
] as const;

export type OperatingModelTemplate = (typeof OPERATING_MODEL_TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<OperatingModelTemplate, string> = {
  team_level: "Team-Level (Scrum/Kanban)",
  essential_safe: "Essential SAFe (erstes ART)",
  portfolio_safe: "Portfolio SAFe (volles Modell)",
  custom: "Eigenes Modell",
};

export interface OperatingModelTemplateDef {
  practices: PracticeFlags;
  structure: StructureTargets;
}

const off: PracticeFlags = {
  portfolioLevel: false,
  programLevel: false,
  stageGates: false,
  wsjf: false,
  multiPartyApproval: false,
  featureQs: false,
  dependencies: false,
  piObjectives: false,
};

/** Practice + structure defaults each template pre-fills. `custom` = all on. */
export const OPERATING_MODEL_TEMPLATE_DEFS: Record<
  OperatingModelTemplate,
  OperatingModelTemplateDef
> = {
  // Just teams running sprints — none of the scaling machinery.
  team_level: {
    practices: { ...off },
    structure: {
      targetValueStreams: null,
      targetArtsTotal: null,
      targetTeamsTotal: null,
      targetPiCadenceWeeks: null,
    },
  },
  // One synchronised train: program level on, portfolio governance off.
  essential_safe: {
    practices: {
      ...off,
      programLevel: true,
      wsjf: true,
      featureQs: true,
      dependencies: true,
      piObjectives: true,
    },
    structure: {
      targetValueStreams: null,
      targetArtsTotal: 1,
      targetTeamsTotal: 5,
      targetPiCadenceWeeks: 10,
    },
  },
  // The full model — every practice on.
  portfolio_safe: {
    practices: { ...DEFAULT_PRACTICES },
    structure: {
      targetValueStreams: 1,
      targetArtsTotal: 2,
      targetTeamsTotal: 10,
      targetPiCadenceWeeks: 10,
    },
  },
  // A starting point management then edits freely.
  custom: {
    practices: { ...DEFAULT_PRACTICES },
    structure: {
      targetValueStreams: null,
      targetArtsTotal: null,
      targetTeamsTotal: null,
      targetPiCadenceWeeks: null,
    },
  },
};

/** The practice flags in force: the model's, or the all-on default when none. */
export function effectivePractices(
  model: Partial<PracticeFlags> | null | undefined,
): PracticeFlags {
  if (!model) return { ...DEFAULT_PRACTICES };
  return {
    portfolioLevel: model.portfolioLevel ?? true,
    programLevel: model.programLevel ?? true,
    stageGates: model.stageGates ?? true,
    wsjf: model.wsjf ?? true,
    multiPartyApproval: model.multiPartyApproval ?? true,
    featureQs: model.featureQs ?? true,
    dependencies: model.dependencies ?? true,
    piObjectives: model.piObjectives ?? true,
  };
}
