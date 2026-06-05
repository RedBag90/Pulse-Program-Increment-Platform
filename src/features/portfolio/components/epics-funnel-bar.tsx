"use client";

import { STAGE_GATES } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";

interface Props {
  /** Pre-counted by the page-model. */
  counts: Record<StageGate, number>;
  /** Currently-active gate filter from URL state. `null` = "Alle". */
  activeGate: StageGate | null;
  /** Toggle the filter — passing the same gate clears it. */
  onGateChange: (gate: StageGate | null) => void;
}

const SEGMENT_BG: Record<StageGate, string> = {
  L0: "bg-muted/40",
  L1: "bg-amber-50",
  L2: "bg-blue-50",
  L3: "bg-indigo-50",
  L4: "bg-primary/10",
  L5: "bg-emerald-50",
};

const SEGMENT_ACTIVE: Record<StageGate, string> = {
  L0: "bg-muted-foreground/30 text-foreground",
  L1: "bg-amber-200 text-amber-900",
  L2: "bg-blue-200 text-blue-900",
  L3: "bg-indigo-200 text-indigo-900",
  L4: "bg-primary text-primary-foreground",
  L5: "bg-emerald-200 text-emerald-900",
};

/**
 * Investment-funnel header: six pills (L0..L5) with each gate's epic count.
 * Click a pill to set `?gate=` URL state; click the active one again to clear.
 * Counts come pre-computed from the page-model so this stays prop-only.
 */
export function EpicsFunnelBar({ counts, activeGate, onGateChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Investment-Funnel</span>
        <button
          type="button"
          onClick={() => onGateChange(null)}
          className={`tabular-nums ${
            activeGate === null ? "text-foreground" : "hover:text-foreground"
          }`}
        >
          Alle {total}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STAGE_GATES.map((gate) => {
          const isActive = activeGate === gate;
          const cls = isActive ? SEGMENT_ACTIVE[gate as StageGate] : SEGMENT_BG[gate as StageGate];
          const count = counts[gate as StageGate] ?? 0;
          return (
            <button
              key={gate}
              type="button"
              onClick={() => onGateChange(isActive ? null : (gate as StageGate))}
              className={`flex flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${cls}`}
              aria-pressed={isActive}
              title={STAGE_GATE_LABELS[gate] ?? gate}
            >
              <span className="truncate">{STAGE_GATE_LABELS[gate] ?? gate}</span>
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
