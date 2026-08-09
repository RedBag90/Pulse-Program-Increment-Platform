/**
 * Ampel-Schwellen für das LPM-Portfolio-Review (SAFe). Eine systemweite Regel
 * für Plantreue und Performance gleichermaßen (Spec): Grün ≥ 90 %, Gelb 70–89 %,
 * Rot < 70 %. Schwellen sind konfigurierbar; Konvention wie im übrigen
 * Ziele-/Portfolio-Code: Eingaben sind 0..1-Verhältnisse (nicht 0..100).
 *
 * Farb-Tier + Hex werden aus {@link GOAL_STATUS_TIER_HEX} wiederverwendet, damit
 * Ampel-Pills, Chart-Bubbles und Fortschrittsbalken denselben Farbraum teilen.
 */

import { type GoalStatusTier, GOAL_STATUS_TIER_HEX } from "@/modules/core/goals/domain/goal-status";

/** Ampel-Tier — Teilmenge der Goal-Tiers (kein "neutral"; jede Kennzahl fällt in Grün/Gelb/Rot). */
export type AmpelTier = Extract<GoalStatusTier, "green" | "amber" | "rose">;

export interface AmpelThresholds {
  /** Untergrenze „Grün" (Default 0.9 = 90 %). */
  green: number;
  /** Untergrenze „Gelb" (Default 0.7 = 70 %); darunter „Rot". */
  amber: number;
}

export const DEFAULT_AMPEL_THRESHOLDS: AmpelThresholds = { green: 0.9, amber: 0.7 };

/** 0..1-Verhältnis → Ampel-Tier anhand der (konfigurierbaren) Schwellen. */
export function thresholdTier(
  ratio: number,
  thresholds: AmpelThresholds = DEFAULT_AMPEL_THRESHOLDS,
): AmpelTier {
  if (ratio >= thresholds.green) return "green";
  if (ratio >= thresholds.amber) return "amber";
  return "rose";
}

/** Deutsche Status-Labels für die Ampel-Tiers (Spec-Wording). */
export const AMPEL_LABEL: Record<AmpelTier, string> = {
  green: "Im Plan",
  amber: "Gefährdet",
  rose: "Kritisch",
};

/** Hex-Farbe je Ampel-Tier (für Chart-Bubbles/Balken); teilt sich den Goal-Farbraum. */
export function ampelHex(tier: AmpelTier): string {
  return GOAL_STATUS_TIER_HEX[tier];
}
