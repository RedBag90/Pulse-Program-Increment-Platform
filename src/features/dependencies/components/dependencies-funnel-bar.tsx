"use client";

import { DEPENDENCY_TYPES, type DependencyType } from "@/server/views/dependencies-list";

interface Props {
  counts: Record<DependencyType, number>;
  activeType: DependencyType | null;
  onTypeChange: (type: DependencyType | null) => void;
}

const SEGMENT_BG: Record<DependencyType, string> = {
  blocks: "bg-red-50",
  depends_on: "bg-amber-50",
  relates_to: "bg-muted/40",
};

const SEGMENT_ACTIVE: Record<DependencyType, string> = {
  blocks: "bg-red-200 text-red-900",
  depends_on: "bg-amber-200 text-amber-900",
  relates_to: "bg-muted-foreground/30 text-foreground",
};

const LABEL: Record<DependencyType, string> = {
  blocks: "Blockiert",
  depends_on: "Hängt ab",
  relates_to: "Bezieht sich",
};

/**
 * Dependency-type funnel: three pills with per-type counts, sorted by
 * criticality (blocks → depends_on → relates_to). Click a pill to toggle
 * `?type=`; click the active pill to clear.
 */
export function DependenciesFunnelBar({ counts, activeType, onTypeChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Dependency-Typ</span>
        <button
          type="button"
          onClick={() => onTypeChange(null)}
          className={`tabular-nums ${activeType === null ? "text-foreground" : "hover:text-foreground"}`}
        >
          Alle {total}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEPENDENCY_TYPES.map((type) => {
          const isActive = activeType === type;
          const cls = isActive ? SEGMENT_ACTIVE[type] : SEGMENT_BG[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(isActive ? null : type)}
              className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${cls}`}
              aria-pressed={isActive}
            >
              <span className="truncate">{LABEL[type]}</span>
              <span className="shrink-0 rounded-full bg-background/60 px-1.5 text-[10px] tabular-nums">
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
