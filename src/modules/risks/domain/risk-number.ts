/**
 * Risk display number. Only the integer `riskNumber` is stored; the display
 * string is computed from the tenant prefix at render, so changing the prefix
 * reformats every existing risk with no backfill.
 */

/** e.g. `formatRiskNumber("RISK-", 42)` → `"RISK-042"`. */
export function formatRiskNumber(prefix: string, n: number, pad = 3): string {
  return `${prefix}${String(n).padStart(pad, "0")}`;
}
