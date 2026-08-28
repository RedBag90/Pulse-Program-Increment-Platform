/**
 * Geteilte Präsentationsschicht für die Issue-Achsen — die **eine** Badge-/Farb-
 * Quelle (analog Drumbeats `features/lib/status-badges.tsx`). Farb-Token je Wert
 * leben ausschließlich hier; die 4 parallelen `BAND_*`-Maps aus `labels.ts` und
 * die verstreuten Inline-`bg-*`-Chips fallen dadurch weg.
 *
 * Werte + Labels kommen aus der Domain-SSOT (`domain/*`, `core/kernel/domain/roam`);
 * die Matrix-SVG liest ihre Hex weiter aus `labels.ts` (`BAND_FILL`).
 * a11y: jedes Badge trägt sein Text-Label (nicht nur Farbe).
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROAM_LABELS, type RoamStatus } from "@/modules/core/kernel/domain/roam";
import type { ExposureBand } from "@/modules/risks/domain/risk-matrix";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";
import type { RiskReviewStatus } from "@/modules/risks/domain/risk-review";
import { CATEGORY_LABELS, REVIEW_LABELS } from "@/modules/risks/features/risk/components/labels";

// ---- Exposure-Band -------------------------------------------------------

/** Bänder nach Severity geordnet (low → critical) — Sortier-/Ordnungs-SSOT
 *  statt eines zweiten `RANK`-Maps. */
export const EXPOSURE_BANDS: readonly ExposureBand[] = ["low", "medium", "high", "critical"];

export function exposureRank(band: ExposureBand | null | undefined): number {
  return band ? EXPOSURE_BANDS.indexOf(band) + 1 : 0;
}

export const EXPOSURE_LABEL: Record<ExposureBand, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

export const EXPOSURE_CLASS: Record<ExposureBand, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

/** Dot-/Streifen-Farbe (Tailwind `bg-*-500`) je Band — kanonischer Hue für
 *  Zeilen-Streifen und Marker. */
export const EXPOSURE_DOT: Record<ExposureBand, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

/** Roh-Hex je Band (für `style`-Farben, z. B. Filter-Dots) — deckungsgleich zu
 *  `EXPOSURE_DOT` (Tailwind `*-500`). */
export const EXPOSURE_HEX: Record<ExposureBand, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

/** Weiche Zell-Tönung je Band — für die Risiko-Matrix (Pastell, damit Marker +
 *  Labels auf beiden Themes lesbar bleiben). */
export const EXPOSURE_CELL: Record<ExposureBand, string> = {
  low: "bg-emerald-100 dark:bg-emerald-950/40",
  medium: "bg-amber-100 dark:bg-amber-950/40",
  high: "bg-orange-200 dark:bg-orange-950/50",
  critical: "bg-red-200 dark:bg-red-950/60",
};

// ---- ROAM (Hues aus der Kernel-SSOT `ROAM_DOT`/`ROAM_HEX`) ---------------

// Kühle/neutrale Palette, deckungsgleich zu `ROAM_DOT`/`ROAM_HEX` (Kernel-SSOT) —
// disjunkt von der warmen Exposure-Skala (siehe `EXPOSURE_CLASS`).
export const ROAM_CLASS: Record<RoamStatus, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  resolved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  owned: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  accepted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  mitigated: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
};

// ---- Kategorie / Review --------------------------------------------------

export const CATEGORY_CLASS =
  "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300";

export const REVIEW_CLASS: Record<RiskReviewStatus, string> = {
  suggested: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  documented: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

// ---- Badge-Komponenten ---------------------------------------------------

export function ExposureBadge({ band, className }: { band: ExposureBand; className?: string }) {
  return (
    <Badge className={cn("border-transparent", EXPOSURE_CLASS[band], className)}>
      {EXPOSURE_LABEL[band]}
    </Badge>
  );
}

export function RoamBadge({ status, className }: { status: RoamStatus; className?: string }) {
  return (
    <Badge className={cn("border-transparent", ROAM_CLASS[status], className)}>
      {ROAM_LABELS[status]}
    </Badge>
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category: RiskCategory;
  className?: string;
}) {
  return (
    <Badge className={cn("border-transparent", CATEGORY_CLASS, className)}>
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

export function ReviewBadge({
  status,
  className,
}: {
  status: RiskReviewStatus;
  className?: string;
}) {
  return (
    <Badge className={cn("border-transparent", REVIEW_CLASS[status], className)}>
      {REVIEW_LABELS[status] ?? status}
    </Badge>
  );
}
