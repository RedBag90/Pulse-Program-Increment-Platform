/** Risk category — an optional classifier for filtering/grouping. */

export const RISK_CATEGORIES = ["technical", "business", "schedule", "external"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export function isRiskCategory(s: string): s is RiskCategory {
  return (RISK_CATEGORIES as readonly string[]).includes(s);
}
