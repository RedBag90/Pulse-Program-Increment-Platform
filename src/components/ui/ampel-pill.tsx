import { GOAL_STATUS_TIER_HEX, type GoalStatusTier } from "@/modules/core/goals/domain/goal-status";
import { cn } from "@/lib/utils";

/**
 * Ampel-Chip — Punkt + Label im geteilten Ampel-Farbraum
 * (`GOAL_STATUS_TIER_HEX`, wie `ProgressBar` und die Chart-Bubbles).
 *
 * Hochgezogen aus `lpm-review-shell.tsx`, wo er als lokale Komponente lag; die
 * Guardrails-Flaeche braucht dieselbe Ampelsprache, soll aber nicht das
 * LPM-Review importieren. Zwei Auspraegungen:
 *
 *  - Default: Punkt + Text, kein Grund — die Variante des LPM-Reviews.
 *  - `tinted`: getoente Pille (Grund = Ampelfarbe bei 12 %), fuer Karten, in
 *    denen der Chip als Status-Badge im Kopf sitzt.
 *
 * Das Label kommt vom Aufrufer: die Wortwahl ist flaechenspezifisch („Im Plan"
 * im Review, „Amber" auf den Guardrails) und haette sonst `ui/` an ein
 * Fach-Modul gebunden.
 */
export function AmpelPill({
  tier,
  label,
  tinted = false,
  className,
}: {
  tier: GoalStatusTier;
  label: string;
  tinted?: boolean;
  className?: string;
}) {
  const hex = GOAL_STATUS_TIER_HEX[tier];
  if (!tinted) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", className)}>
        <span className="size-2 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5",
        "text-[10.5px] font-medium uppercase tracking-[0.08em]",
        className,
      )}
      // `1f` = 12 % Alpha auf demselben Ton — eine Farbe, zwei Rollen.
      style={{ color: hex, backgroundColor: `${hex}1f` }}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
