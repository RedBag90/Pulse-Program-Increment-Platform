"use client";

import {
  ROAM_HEX,
  ROAM_LABELS,
  ROAM_STATUSES,
  type RoamStatus,
} from "@/modules/core/kernel/domain/roam";

interface Props {
  funnel: Record<RoamStatus, number>;
  activeStatus: RoamStatus | null;
  onSelect: (status: RoamStatus | null) => void;
}

/** ROAM disposition funnel — one chip per disposition, coloured by cluster. */
export function RiskRoamBoard({ funnel, activeStatus, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROAM_STATUSES.map((s) => {
        const active = activeStatus === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(active ? null : s)}
            aria-pressed={active}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
              active ? "border-primary bg-primary/10" : "border-input bg-card hover:bg-muted/50"
            }`}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: ROAM_HEX[s] }} />
            {ROAM_LABELS[s]}
            <span className="tabular-nums text-muted-foreground">{funnel[s]}</span>
          </button>
        );
      })}
    </div>
  );
}
