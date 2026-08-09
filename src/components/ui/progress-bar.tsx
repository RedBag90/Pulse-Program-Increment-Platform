import { GOAL_STATUS_TIER_HEX, type GoalStatusTier } from "@/modules/core/goals/domain/goal-status";

/**
 * Fortschrittsbalken Ist-% vs. Soll-%: gefüllter Balken (Ampelfarbe) plus eine
 * Soll-Markierung. `actual`/`target` sind 0..1-Verhältnisse. Rein präsentational
 * — teilt den Ampel-Farbraum (`GOAL_STATUS_TIER_HEX`) mit Pills und Charts.
 */
export function ProgressBar({
  actual,
  target = 1,
  tier,
  className,
}: {
  actual: number | null;
  target?: number;
  tier: GoalStatusTier;
  className?: string;
}) {
  const pct = actual == null ? 0 : Math.min(100, Math.max(0, actual * 100));
  const targetPct = Math.min(100, Math.max(0, target * 100));
  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-muted ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, backgroundColor: GOAL_STATUS_TIER_HEX[tier] }}
      />
      {/* Soll-Markierung */}
      <span
        className="absolute top-0 h-full w-px bg-foreground/50"
        style={{ left: `${targetPct}%` }}
        aria-hidden
      />
    </div>
  );
}
