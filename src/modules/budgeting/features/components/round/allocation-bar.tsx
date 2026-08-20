"use client";

import { ProgressBar } from "@/components/ui/progress-bar";
import type { GoalStatusTier } from "@/modules/core/goals/domain/goal-status";
import { formatCompactEUR } from "@/lib/formatting";

interface Props {
  /** Bereits verteilter Betrag der Periode. */
  allocated: number;
  /** Verfügbares Budget der Periode (Topf bzw. Wertstrom-Budget). */
  budget: number;
}

/**
 * Auslastungs-Balken je Halbjahr: verteilt vs. verfügbar. Ampel über den
 * gemeinsamen `ProgressBar` — grün unter Budget, gelb ab 90 %, rot bei
 * Überallokation (≥ 100 %). Neutral, wenn kein Budget gesetzt ist.
 */
export function AllocationBar({ allocated, budget }: Props) {
  const ratio = budget > 0 ? allocated / budget : 0;
  const over = budget > 0 && allocated > budget;
  const tier: GoalStatusTier =
    budget <= 0 ? "neutral" : over ? "rose" : ratio >= 0.9 ? "amber" : "green";
  const pct = budget > 0 ? Math.round(ratio * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-muted-foreground">
        <span className="tabular-nums">
          {formatCompactEUR(allocated)} / {formatCompactEUR(budget)}
        </span>
        <span className={`tabular-nums ${over ? "text-destructive" : ""}`}>{pct}%</span>
      </div>
      <ProgressBar actual={ratio} target={1} tier={tier} />
    </div>
  );
}
