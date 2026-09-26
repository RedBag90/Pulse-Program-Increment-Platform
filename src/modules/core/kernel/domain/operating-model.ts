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
  "artEpics",
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

/**
 * Wenn kein Zielbild definiert ist, ist alles an — **auch `artEpics`.**
 *
 * Bis September 2026 war das die eine Ausnahme, mit der Begründung: „Ein
 * Schalter, der Geldflüsse umleitet, darf nicht stillschweigend angehen."
 * Die Begründung war richtig und trifft trotzdem nicht auf das Zeitfenster zu,
 * in dem die Einordnung gebraucht wird:
 *
 *  - Geld halten darf ein Epic erst ab **L2** (`FIRST_FUNDABLE_STEP`),
 *    durchgesetzt als `businessCaseApprovedAt != null`.
 *  - `classifyEpic` liefert vor der Business-Case-Freigabe `null`, und **alle**
 *    Klassenweichen im Budgeting vergleichen gegen genau diesen Wert.
 *
 * Vor L2 leitet eine Einordnung also nichts um — sie ist eine Erwartung. Und
 * genau die braucht man von Anfang an: ob ein Vorhaben ein grosses oder ein
 * kleines ist, will man sagen können, bevor die Kosten stehen, nicht erst
 * danach. Ab L2 steht die Klasse ohnehin fest, und dort greift der alte
 * Einwand weiter — nur ist er dann keine Frage des Schalters mehr.
 */
export const DEFAULT_PRACTICES: PracticeFlags = {
  portfolioLevel: true,
  programLevel: true,
  stageGates: true,
  wsjf: true,
  multiPartyApproval: true,
  featureQs: true,
  dependencies: true,
  artEpics: true,
};

/** Katalog-Schlüssel für den Konfigurator und das Glossar (ADR-0024, Regel 2). */
export const PRACTICE_KEYS: Record<Practice, string> = {
  portfolioLevel: "practices.portfolioLevel",
  programLevel: "practices.programLevel",
  stageGates: "practices.stageGates",
  wsjf: "practices.wsjf",
  multiPartyApproval: "practices.multiPartyApproval",
  featureQs: "practices.featureQs",
  dependencies: "practices.dependencies",
  artEpics: "practices.artEpics",
};

export type OperatingModelTemplate = "team_level" | "essential_safe" | "portfolio_safe" | "custom";

export interface OperatingModelTemplateDef {
  practices: PracticeFlags;
  structure: StructureTargets;
}

const off: PracticeFlags = {
  artEpics: false,
  portfolioLevel: false,
  programLevel: false,
  stageGates: false,
  wsjf: false,
  multiPartyApproval: false,
  featureQs: false,
  dependencies: false,
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
    // Seit September 2026 keine Ausnahme mehr — siehe DEFAULT_PRACTICES.
    // Achtung: `art_epics` ist NOT NULL mit DB-Default, ein gespeichertes
    // Zielbild trägt also immer einen echten Wert. Dieses `??` greift nur für
    // Teilobjekte im Speicher, nicht für Zeilen aus der Datenbank.
    artEpics: model.artEpics ?? true,
    portfolioLevel: model.portfolioLevel ?? true,
    programLevel: model.programLevel ?? true,
    stageGates: model.stageGates ?? true,
    wsjf: model.wsjf ?? true,
    multiPartyApproval: model.multiPartyApproval ?? true,
    featureQs: model.featureQs ?? true,
    dependencies: model.dependencies ?? true,
  };
}
