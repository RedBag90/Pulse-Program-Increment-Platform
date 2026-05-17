/**
 * Epic Benefit Hypothesis — the SAFe "Working hypothesis" artefact, formulated
 * during the L1 Reviewing stage gate. Persisted in `Initiative.benefitHypothesis`
 * (JSON) for Epics, with a saved-version history.
 */

export interface BenefitHypothesisFields {
  /** Maßnahmen-Hypothese — the solution/measures hypothesis. */
  measuresHypothesis?: string | undefined;
  /** Veränderung ggü. Startpunkt — how this differs from the current baseline. */
  changeFromBaseline?: string | undefined;
  /** Measurable benefits the business can achieve. */
  businessOutcomes?: string[] | undefined;
  /** Early indicators that predict the business outcomes. */
  leadingIndicators?: string[] | undefined;
  /** Risks and dependencies. */
  risks?: string[] | undefined;
}

export interface BenefitHypothesisVersion {
  content: BenefitHypothesisFields;
  /** ISO timestamp of when this version was superseded. */
  savedAt: string;
  /** userId that saved this version. */
  savedBy: string;
}

export interface BenefitHypothesis {
  current: BenefitHypothesisFields;
  history: BenefitHypothesisVersion[];
}

/**
 * Reads a stored Benefit Hypothesis JSON value. Accepts both the versioned shape
 * (`{ current, history }`) and a legacy flat shape (fields at the top level).
 */
export function parseBenefitHypothesis(raw: unknown): BenefitHypothesis {
  if (raw == null || typeof raw !== "object") {
    return { current: {}, history: [] };
  }
  const obj = raw as Record<string, unknown>;
  if ("current" in obj) {
    return {
      current: (obj["current"] as BenefitHypothesisFields | null) ?? {},
      history: Array.isArray(obj["history"]) ? (obj["history"] as BenefitHypothesisVersion[]) : [],
    };
  }
  return { current: obj as BenefitHypothesisFields, history: [] };
}

/** True when a Benefit Hypothesis field set carries any content. */
export function benefitHypothesisHasContent(fields: BenefitHypothesisFields): boolean {
  return Object.values(fields).some((v) => {
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.some((item) => item.trim() !== "");
    return false;
  });
}
