"use client";

import { useTranslations } from "next-intl";
import { STAGE_GATES, SUB_STAGES_BY_GATE, type SubStage } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATE_KEYS, SUB_STAGE_KEYS } from "@/components/detail/initiative-labels";

interface Props {
  /** Pre-counted by the page-model. */
  counts: Record<StageGate, number>;
  /** Sub-Step-Counts (L3.1 / L3.2 / L4.1 / L4.2). UI-only Breakdown unter
   *  den L2- und L4-Pills. */
  subStageCounts: Record<SubStage, number>;
  /** Currently-active gate filter from URL state. `null` = "Alle". */
  activeGate: StageGate | null;
  /** Toggle the filter — passing the same gate clears it. */
  onGateChange: (gate: StageGate | null) => void;
}

/**
 * **Ein Farbton, steigende Dichte** — statt eines Regenbogens über die
 * Stufennummer.
 *
 * Bis September 2026 war L1 Amber, L2 Blau, L3 Indigo, L5 Emerald. Das liest
 * sich wie eine Kategorie („blau ist etwas anderes als grün"), gemeint ist
 * aber eine **Reihenfolge**: je weiter rechts, desto reifer das Vorhaben. Eine
 * Sättigungsleiter auf `--primary` sagt genau das — und sie trägt in beiden
 * Themen, weil sie aus einem Token kommt statt aus acht Palettenwerten
 * (ADR-0021).
 */
const SEGMENT_BG: Record<StageGate, string> = {
  L0: "bg-primary/[0.04]",
  L1: "bg-primary/[0.07]",
  L2: "bg-primary/10",
  L3: "bg-primary/[0.14]",
  L4: "bg-primary/[0.18]",
  L5: "bg-primary/[0.22]",
};

/** Ausgewählt ist ausgewählt — die Stufe steht schon in der Beschriftung. */
const SEGMENT_ACTIVE: Record<StageGate, string> = {
  L0: "bg-primary text-primary-foreground",
  L1: "bg-primary text-primary-foreground",
  L2: "bg-primary text-primary-foreground",
  L3: "bg-primary text-primary-foreground",
  L4: "bg-primary text-primary-foreground",
  L5: "bg-primary text-primary-foreground",
};

/**
 * Investment-funnel header: six pills (L0..L5) with each gate's epic count.
 * Click a pill to set `?gate=` URL state; click the active one again to clear.
 * Counts come pre-computed from the page-model so this stays prop-only.
 *
 * Sub-Step-Breakdown wird unter den L2- und L4-Pills als Mini-Indikator
 * gerendert (L3.1/L3.2, L4.1/L4.2). Die Sub-Steps sind nicht klickbar —
 * sie sind eine Reife-Anzeige, kein eigener Filter (der Major-Gate-Filter
 * deckt sie bereits ab).
 */
export function EpicsFunnelBar({ counts, subStageCounts, activeGate, onGateChange }: Props) {
  const t = useTranslations();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2" data-tour="epics-funnel-bar">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("work.epic.reifegradFunnel")}</span>
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
                title={t(STAGE_GATE_KEYS[gate] ?? gate)}
              >
                <span className="truncate">{t(STAGE_GATE_KEYS[gate] ?? gate)}</span>
                <span className="shrink-0 rounded-full bg-background/60 px-1.5 text-label tabular-nums">
                  {count}
                </span>
              </button>
              {subSteps && (
                <div className="flex gap-0.5 px-0.5">
                  {subSteps.map((s) => (
                    <span
                      key={s}
                      title={`${s} ${t(SUB_STAGE_KEYS[s] ?? s)}`}
                      className="flex flex-1 items-center justify-between gap-1 rounded-md bg-background/40 px-1.5 py-0.5 text-label text-muted-foreground"
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
