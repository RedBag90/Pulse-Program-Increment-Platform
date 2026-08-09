import { GOAL_STATUS_TIER_HEX } from "@/modules/core/goals/domain/goal-status";
import type { LpmAmpel } from "@/modules/work/domain/lpm-review";

/** Geteilte Chart-Tokens für das LPM-Review (ruhig/flach, eine Akzentfarbe Blau). */

/** Akzent Blau — Ist/Forecast-Linien (wie WSJF-Chart). */
export const ACCENT = "oklch(0.623 0.214 259.815)";
/** Neutralgrau — Plan-Werte (Balken/Linien). */
export const PLAN_GREY = "#94a3b8";

/** Ampel-Tier (inkl. neutral) → Hex; teilt den Goal-Farbraum. */
export function tierHex(tier: LpmAmpel): string {
  return GOAL_STATUS_TIER_HEX[tier];
}

/** Einheitlicher Tooltip-Stil (Popover-Look). */
export const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;
