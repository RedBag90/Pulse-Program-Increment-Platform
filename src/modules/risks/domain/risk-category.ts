/** Risk category — an optional classifier for filtering/grouping. */

export const RISK_CATEGORIES = ["technical", "business", "schedule", "external"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export function isRiskCategory(s: string): s is RiskCategory {
  return (RISK_CATEGORIES as readonly string[]).includes(s);
}

/**
 * Beschriftung je Kategorie. Steht bei der Aufzählung, nicht in der
 * Präsentationsschicht: die Gruppierung (`issue-grouping.ts`) braucht sie, und
 * eine Domänenregel darf nicht in `features/` lesen (ADR-0013).
 */
export const CATEGORY_KEYS: Record<RiskCategory, string> = {
  technical: "risks.category.technical",
  business: "risks.category.business",
  schedule: "risks.category.schedule",
  external: "risks.category.external",
};
