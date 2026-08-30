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
  color,
  targetLabel,
  className,
}: {
  actual: number | null;
  target?: number;
  tier: GoalStatusTier;
  /** Ueberschreibt die Ampelfarbe des Fills — z. B. der Horizont-Ton. */
  color?: string;
  /** Beschriftung ueber der Soll-Markierung (z. B. „60" oder „Ziel 90 %"). */
  targetLabel?: string;
  className?: string;
}) {
  const pct = actual == null ? 0 : Math.min(100, Math.max(0, actual * 100));
  const targetPct = Math.min(100, Math.max(0, target * 100));
  return (
    // `overflow-hidden` sitzt am inneren Wrapper, nicht hier: sonst beschnitte
    // es die Marker-Beschriftung, die bewusst ueber den Balken hinausragt.
    <div
      className={`relative h-2 w-full rounded-full bg-muted ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color ?? GOAL_STATUS_TIER_HEX[tier] }}
        />
      </div>
      {/* Soll-Markierung */}
      <span
        className="absolute top-0 h-full w-px bg-foreground/50"
        style={{ left: `${targetPct}%` }}
        aria-hidden
      />
      {targetLabel && (
        <span
          className="absolute -top-4 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] text-foreground/70"
          style={{ left: `${targetPct}%` }}
          aria-hidden
        >
          {targetLabel}
        </span>
      )}
    </div>
  );
}
