"use client";

import { STAGE_GATES, SUB_STAGES_BY_GATE, type SubStage } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATE_LABELS, SUB_STAGE_LABELS } from "@/components/detail/initiative-labels";

interface Props {
  /** Pre-counted by the page-model. */
  counts: Record<StageGate, number>;
  /** Sub-Step-Counts (L2.1 / L2.2 / L4.1 / L4.2). UI-only Breakdown unter
   *  den L2- und L4-Pills. */
  subStageCounts: Record<SubStage, number>;
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
 *
 * Sub-Step-Breakdown wird unter den L2- und L4-Pills als Mini-Indikator
 * gerendert (L2.1/L2.2, L4.1/L4.2). Die Sub-Steps sind nicht klickbar —
 * sie sind eine Reife-Anzeige, kein eigener Filter (der Major-Gate-Filter
 * deckt sie bereits ab).
 */
export function EpicsFunnelBar({ counts, subStageCounts, activeGate, onGateChange }: Props) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2" data-tour="epics-funnel-bar">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Reifegrad-Funnel</span>
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
          const subSteps = SUB_STAGES_BY_GATE[gate as StageGate];
          return (
            <div key={gate} className="flex flex-1 flex-col gap-0.5">
              <button
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
              {subSteps && (
                <div className="flex gap-0.5 px-0.5">
                  {subSteps.map((s) => (
                    <span
                      key={s}
                      title={`${s} ${SUB_STAGE_LABELS[s]}`}
                      className="flex flex-1 items-center justify-between gap-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <span className="truncate">{s}</span>
                      <span className="tabular-nums">{subStageCounts[s] ?? 0}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
