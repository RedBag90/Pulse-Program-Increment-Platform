/**
 * WSJF tier — the Drumbeat tiering rule for a Feature's `wsjfComputed`
 * (≥ 8 → high, ≥ 4 → medium, else → low; `null` → `"unscored"`). Consumed by
 * the feature-detail and breakdown-network page-models.
 *
 * The bucketing itself lives in the shared LOW primitive `wsjfBand`
 * (`@/modules/core/kernel/domain/wsjf`); this is a thin call that pins the Drumbeat
 * thresholds + label. The ART feature lists (`server/views/features-list.ts`,
 * `features-overview.ts`) call the same primitive with ≥ 5 / ≥ 2 / `"none"` —
 * that divergence is now a DATA difference, not a forked implementation.
 */
import { wsjfBand } from "@/modules/core/kernel/domain/wsjf";

export type WsjfTier = "high" | "medium" | "low" | "unscored";

export function wsjfTier(computed: number | null): WsjfTier {
  return wsjfBand(computed, { high: 8, medium: 4, missingLabel: "unscored" });
}
