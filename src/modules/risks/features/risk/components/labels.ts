import type { RiskLevel, ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";

export const LEVEL_LABELS: Record<RiskLevel, string> = {
  very_low: "Sehr niedrig",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  very_high: "Sehr hoch",
};

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  technical: "Technisch",
  business: "Business",
  schedule: "Termin",
  external: "Extern",
};

export const REVIEW_LABELS: Record<string, string> = {
  suggested: "Vorschlag",
  documented: "Dokumentiert",
  rejected: "Abgelehnt",
};

/** Tailwind band tints for the matrix cell background. */
export const BAND_BG: Record<ExposureBand, string> = {
  low: "bg-emerald-100 dark:bg-emerald-950/40",
  medium: "bg-amber-100 dark:bg-amber-950/40",
  high: "bg-orange-200 dark:bg-orange-950/50",
  critical: "bg-red-300 dark:bg-red-950/60",
};

export const BAND_BADGE: Record<ExposureBand, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

export const BAND_LABEL: Record<ExposureBand, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};
