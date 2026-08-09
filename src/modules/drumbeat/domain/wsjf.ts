/**
 * WSJF tier — the canonical tiering rule for a Feature's `wsjfComputed`.
 *
 * Two consumers used to redefine the function inline (feature-detail page-
 * model and breakdown-network-view page-model). The duplicated thresholds
 * (≥ 8 → high, ≥ 4 → medium, else → low; `null` → unscored) are the
 * agreed-upon contract; the feature-detail file's "Detail-Pille und
 * Listen-Pille deckungsgleich" comment named that intent.
 *
 * A *third* derivation lives in `src/server/views/features-list.ts` with
 * different thresholds (≥ 5 → high, ≥ 2 → medium) and uses `"none"` instead
 * of `"unscored"` for the missing-score label. That divergence is intentional
 * for the ART feature list today — it is **not** consumed by this module.
 * Aligning the two is a product decision; if you do unify, point both at
 * this file.
 */

export type WsjfTier = "high" | "medium" | "low" | "unscored";

export function wsjfTier(computed: number | null): WsjfTier {
  if (computed == null) return "unscored";
  if (computed >= 8) return "high";
  if (computed >= 4) return "medium";
  return "low";
}
