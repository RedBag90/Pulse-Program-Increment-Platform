"use client";

import { useActionState, useEffect, startTransition } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { advanceStageGateBatchAction } from "@/features/portfolio/actions/stage-gate";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import type { EpicListRow } from "@/server/views/portfolio-epics-list";

interface Props {
  /** Currently-selected rows — the bar shows only when ≥ 1. */
  selectedRows: EpicListRow[];
  canAdvance: boolean;
  onClear: () => void;
}

/**
 * Sticky bottom-of-screen action bar for the portfolio epics list. Appears
 * when ≥ 1 row is selected. Drives the **bulk Stage-Gate advance/retreat**
 * via the new `advanceStageGateBatchAction` (Round 3 batch mode). The bar
 * picks the direction (↑ / ↓) and computes the target gate from the *minimum*
 * gate in the selection — moving "up" advances each selected epic by one
 * step from its current gate (the service walks each id independently). When
 * the selection straddles multiple gates the action becomes ambiguous, so
 * the bar shows a hint and disables advance.
 *
 * The bar is read-only when the user lacks `epic.approve` — selection still
 * works for read-only review use cases.
 */
export function EpicsBulkActionBar({ selectedRows, canAdvance, onClear }: Props) {
  const [state, dispatch, pending] = useActionState(advanceStageGateBatchAction, {});

  useEffect(() => {
    if (state.success) onClear();
  }, [state.success, onClear]);

  if (selectedRows.length === 0) return null;

  const gates = new Set(selectedRows.map((r) => r.stageGate));
  const mixed = gates.size > 1;
  // When all rows share a gate, derive the adjacent target. Else null.
  const sharedGate = !mixed ? (selectedRows[0]!.stageGate as StageGate) : null;
  const sharedIdx = sharedGate ? STAGE_GATES.indexOf(sharedGate) : -1;
  // L2 → L3 und L4 → L5 sind nur via Workflow-Trigger erreichbar
  // (Single-Source: src/domain/epic-lifecycle-doc.ts BLOCKED_MANUAL_TRANSITIONS).
  const nextIsAutoOnly = sharedGate === "L2" || sharedGate === "L4";
  const nextGate: StageGate | null =
    sharedGate && !nextIsAutoOnly && sharedIdx < STAGE_GATES.length - 1
      ? (STAGE_GATES[sharedIdx + 1] as StageGate)
      : null;
  const prevGate: StageGate | null =
    sharedGate && sharedIdx > 0 ? (STAGE_GATES[sharedIdx - 1] as StageGate) : null;

  function bulkMove(toGate: StageGate | null) {
    if (!toGate) return;
    const fd = new FormData();
    for (const r of selectedRows) fd.append("epicIds", r.id);
    fd.set("toGate", toGate);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
          {selectedRows.length} ausgewählt
        </span>

        {mixed ? (
          <span className="text-xs text-muted-foreground">
            Auswahl umfasst mehrere Stage Gates — Bulk-Übergang nicht möglich.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            in {STAGE_GATE_LABELS[sharedGate!] ?? sharedGate}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canAdvance && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || !prevGate}
                onClick={() => bulkMove(prevGate)}
                title={prevGate ? `→ ${STAGE_GATE_LABELS[prevGate]}` : "Bereits L0"}
              >
                <ChevronDown className="size-3.5" />
                Stage ↓
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || !nextGate}
                onClick={() => bulkMove(nextGate)}
                title={
                  nextGate
                    ? `→ ${STAGE_GATE_LABELS[nextGate]}`
                    : sharedGate === "L2"
                      ? "L3 wird automatisch beim Speichern eines Budgets > 0 erreicht"
                      : sharedGate === "L4"
                        ? "L5 wird nur per Impact-Bestaetigung erreicht"
                        : "Bereits L5"
                }
              >
                <ChevronUp className="size-3.5" />
                Stage ↑
              </Button>
            </>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClear}
            aria-label="Auswahl aufheben"
            className="size-8"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {state.error && (
          <p role="alert" className="mt-1 w-full text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
