"use client";

import { IMPEDIMENT_STATUSES, type ImpedimentStatus } from "@/server/views/impediments-list";

interface Props {
  counts: Record<ImpedimentStatus, number>;
  activeStatus: ImpedimentStatus | null;
  onStatusChange: (status: ImpedimentStatus | null) => void;
}

const SEGMENT_BG: Record<ImpedimentStatus, string> = {
  open: "bg-blue-50",
  escalated: "bg-purple-50",
  resolved: "bg-emerald-50",
};

const SEGMENT_ACTIVE: Record<ImpedimentStatus, string> = {
  open: "bg-blue-200 text-blue-900",
  escalated: "bg-purple-200 text-purple-900",
  resolved: "bg-emerald-200 text-emerald-900",
};

const LABEL: Record<ImpedimentStatus, string> = {
  open: "Offen",
  escalated: "Eskaliert",
  resolved: "Aufgelöst",
};

/**
 * Impediment-status funnel: three pills with per-status counts. Same
 * shape as the features/epics funnels, swapping colours to the
 * impediment-specific palette.
 */
export function ImpedimentsFunnelBar({ counts, activeStatus, onStatusChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Impediment-Status</span>
        <button
          type="button"
          onClick={() => onStatusChange(null)}
          className={`tabular-nums ${activeStatus === null ? "text-foreground" : "hover:text-foreground"}`}
        >
          Alle {total}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {IMPEDIMENT_STATUSES.map((status) => {
          const isActive = activeStatus === status;
          const cls = isActive ? SEGMENT_ACTIVE[status] : SEGMENT_BG[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => onStatusChange(isActive ? null : status)}
              className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${cls}`}
              aria-pressed={isActive}
            >
              <span className="truncate">{LABEL[status]}</span>
              <span className="shrink-0 rounded-full bg-background/60 px-1.5 text-[10px] tabular-nums">
                {counts[status]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
