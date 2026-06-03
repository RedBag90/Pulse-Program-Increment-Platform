import type { StageGate } from "@/server/services/portfolio-overview";

/**
 * SAFe-typical soft WIP limits per portfolio Kanban stage. `null` = no limit.
 * Soft limits: surfaced visually (column header tinted, "N / Limit ⚠"), not
 * enforced. A follow-up iteration can move these to a tenant-configurable
 * Settings row.
 */
export const PORTFOLIO_WIP_LIMITS: Record<StageGate, number | null> = {
  L0: null, // Funnel — unlimited intake
  L1: 5,
  L2: 3,
  L3: 7,
  L4: 8,
  L5: null, // Done — unlimited
};

/** True when this stage carries more items than its soft limit allows. */
export function isOverWip(gate: StageGate, count: number): boolean {
  const limit = PORTFOLIO_WIP_LIMITS[gate];
  return limit !== null && count > limit;
}

/** "5 / 3 ⚠" or "5 / ∞" or "2 / 5" — the header counter text. */
export function wipCountLabel(gate: StageGate, count: number): string {
  const limit = PORTFOLIO_WIP_LIMITS[gate];
  if (limit === null) return `${count} / ∞`;
  return `${count} / ${limit}${count > limit ? " ⚠" : ""}`;
}
