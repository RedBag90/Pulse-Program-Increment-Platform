"use client";

import { ROAM_LABELS, ROAM_STATUSES, type RoamStatus } from "@/modules/core/kernel/domain/roam";

/** ROAM funnel — the shared axis across both issue kinds. Click a pill to filter;
 *  clicking the active one clears it. "Alle" resets. */
export function IssuesFunnelBar({
  counts,
  activeRoam,
  onRoamChange,
}: {
  counts: Record<RoamStatus, number>;
  activeRoam: RoamStatus | null;
  onRoamChange: (roam: RoamStatus | null) => void;
}) {
  const total = ROAM_STATUSES.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onRoamChange(null)}
        aria-pressed={activeRoam === null}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
          activeRoam === null ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
        }`}
      >
        Alle
        <span className="tabular-nums text-muted-foreground">{total}</span>
      </button>
      {ROAM_STATUSES.map((s) => {
        const active = activeRoam === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onRoamChange(active ? null : s)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              active ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
            }`}
          >
            {ROAM_LABELS[s]}
            <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
          </button>
        );
      })}
    </div>
  );
}
