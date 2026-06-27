/**
 * Epic Benefit Hypothesis — the SAFe "Working hypothesis" artefact, formulated
 * during the L1 Reviewing stage gate. Persisted in `Initiative.benefitHypothesis`
 * (JSON) for Epics, with a saved-version history. The envelope + history
 * mechanics live in `domain/versioned-document.ts`; this file owns the
 * hypothesis-specific fields and the "has content" predicate.
 */

import {
  parseVersionedDocument,
  type VersionedDocument,
  type VersionSnapshot,
} from "@/domain/versioned-document";

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

export type BenefitHypothesisVersion = VersionSnapshot<BenefitHypothesisFields>;
export type BenefitHypothesis = VersionedDocument<BenefitHypothesisFields>;

/**
 * Reads a stored Benefit Hypothesis JSON value. Accepts both the versioned shape
 * (`{ current, history }`) and a legacy flat shape (fields at the top level).
 */
export function parseBenefitHypothesis(raw: unknown): BenefitHypothesis {
  return parseVersionedDocument<BenefitHypothesisFields>(raw, (f) => f, {});
}

/** True when a Benefit Hypothesis field set carries any content. */
export function benefitHypothesisHasContent(fields: BenefitHypothesisFields): boolean {
  return Object.values(fields).some((v) => {
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.some((item) => item.trim() !== "");
    return false;
  });
}
