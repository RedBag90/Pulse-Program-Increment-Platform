"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import type { EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";

interface Props {
  /** Currently-selected rows — the bar shows only when ≥ 1. */
  selectedRows: EpicListRow[];
  onClear: () => void;
}

/**
 * Sticky Auswahl-Leiste der Portfolio-Epics-Liste.
 *
 * Die früheren „Stage ↑ / Stage ↓"-Knöpfe sind bewusst entfallen. Ein
 * Reifegrad-Wechsel wird jetzt von namentlich benannten Personen abgenommen —
 * eine Massen-Beantragung über eine gemischte Auswahl ist keine sinnvolle
 * Geste: sie träfe je Epic andere Abnehmer, andere Kriterien und andere offene
 * Anträge. Der Wechsel läuft über die Gate-Karte am einzelnen Epic.
 *
 * Damit fällt auch die client-seitige Kopie der Übergangsregeln weg, die hier
 * `BLOCKED_MANUAL_TRANSITIONS` nachgebaut hatte und bei jeder Regeländerung
 * hätte nachgezogen werden müssen.
 */
export function EpicsBulkActionBar({ selectedRows, onClear }: Props) {
  if (selectedRows.length === 0) return null;

  const gates = new Set(selectedRows.map((r) => r.stageGate));
  const sharedGate = gates.size === 1 ? selectedRows[0]!.stageGate : null;

  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-full border bg-card px-4 py-2 shadow-lg">
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground tabular-nums">
          {selectedRows.length} ausgewählt
        </span>

        <span className="text-xs text-muted-foreground">
          {sharedGate
            ? `in ${STAGE_GATE_LABELS[sharedGate] ?? sharedGate}`
            : `über ${gates.size} Reifegrade verteilt`}
        </span>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClear}
          aria-label="Auswahl aufheben"
          className="ml-auto size-8"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
