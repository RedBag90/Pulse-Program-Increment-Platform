/**
 * Rest-Labels. Die Band-Präsentation (Klassen/Farben/Zell-Tönung/Badges) lebt in
 * `features/lib/issue-badges.tsx` (SSOT); hier bleiben nur die Achsen-/Kategorie-/
 * Review-Labels (Matrix-Achsen + Selektoren).
 */
import type { RiskLevel } from "@/modules/risks/domain/risk-matrix";
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
