"use client";

import { FEATURE_STATUSES, type FeatureStatus } from "@/server/views/features-list";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";

interface Props {
  counts: Record<FeatureStatus, number>;
  activeStatus: FeatureStatus | null;
  onStatusChange: (status: FeatureStatus | null) => void;
}

const SEGMENT_BG: Record<FeatureStatus, string> = {
  draft: "bg-muted/40",
  approved: "bg-blue-50",
  in_progress: "bg-primary/10",
  completed: "bg-emerald-50",
};

const SEGMENT_ACTIVE: Record<FeatureStatus, string> = {
  draft: "bg-muted-foreground/30 text-foreground",
  approved: "bg-blue-200 text-blue-900",
  in_progress: "bg-primary text-primary-foreground",
  completed: "bg-emerald-200 text-emerald-900",
};

/**
 * Feature-lifecycle funnel header: four pills with per-status epic counts.
 * Click a pill → `?status=`; click again to clear. Counts come pre-computed
 * from the page-model so this stays prop-only. Mirrors `epics-funnel-bar.tsx`.
 */
export function FeaturesFunnelBar({ counts, activeStatus, onStatusChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Feature-Status</span>
        <button
          type="button"
          onClick={() => onStatusChange(null)}
          className={`tabular-nums ${activeStatus === null ? "text-foreground" : "hover:text-foreground"}`}
        >
          Alle {total}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FEATURE_STATUSES.map((status) => {
          const isActive = activeStatus === status;
          const cls = isActive ? SEGMENT_ACTIVE[status] : SEGMENT_BG[status];
          const count = counts[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(isActive ? null : status)}
              className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${cls}`}
              aria-pressed={isActive}
            >
              <span className="truncate">{STATUS_LABELS[status] ?? status}</span>
              <span className="shrink-0 rounded-full bg-background/60 px-1.5 text-[10px] tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
