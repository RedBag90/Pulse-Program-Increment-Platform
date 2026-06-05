"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { STAGE_GATES } from "@/domain/stage-gate";
import type { StageGate } from "@/domain/types";
import { STAGE_GATE_LABELS } from "@/components/detail/initiative-labels";
import { EpicListRowComponent } from "@/features/portfolio/components/epic-list-row";
import type { EpicListRow } from "@/server/views/portfolio-epics-list";

interface Props {
  rows: EpicListRow[];
  canEdit: boolean;
  canAdvance: boolean;
  stageGatesEnabled: boolean;
  /** "flat" = one body, sorted; "stage" = six collapsible sections per gate. */
  group: "flat" | "stage";
  compact: boolean;
  /** Selection set — when null, hides the checkbox column entirely (read-only mode). */
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
  onToggleSelectAll: ((ids: string[]) => void) | null;
}

/**
 * Master table for the portfolio epics list. Renders the already-filtered +
 * sorted row list in one of two grouping modes:
 *
 * - **flat** — single `<tbody>` with sort applied directly; the dominant mode
 *   when the user is filtering or searching ("show me everything matching X
 *   sorted by Y").
 * - **stage** — six collapsible `<tbody>` sections, one per L0..L5, matching
 *   the funnel structure of the deleted `<EpicsStageGateTable>` (the old
 *   page's only mode). Useful when the user wants to scan the investment
 *   pipeline rather than the metrics.
 *
 * The header carries column labels + an optional "select all" checkbox that
 * toggles every visible row. Each row owns its inline actions; the table
 * itself stays prop-only.
 */
export function EpicsListTable({
  rows,
  canEdit,
  canAdvance,
  stageGatesEnabled,
  group,
  compact,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Epics gefunden — Filter anpassen oder neues Epic anlegen.
      </div>
    );
  }

  const showSelection = selectedIds !== null;
  const allVisibleSelected =
    showSelection && rows.length > 0 && rows.every((r) => selectedIds!.has(r.id));

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            {showSelection && (
              <th className="w-8 py-2 pl-3 pr-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => onToggleSelectAll?.(rows.map((r) => r.id))}
                  className="size-4 rounded border-border"
                  aria-label="Alle sichtbaren auswählen"
                />
              </th>
            )}
            <th className="py-2 pr-3 text-left">Titel</th>
            {!compact && <th className="py-2 pr-3 text-left">Owner</th>}
            {!compact && <th className="py-2 pr-3 text-left">Wertstrom</th>}
            <th className="py-2 pr-3 text-left">Phase</th>
            <th className="py-2 pr-3 text-left">Status</th>
            {!compact && <th className="py-2 pr-3 text-right">Kosten</th>}
            {!compact && <th className="py-2 pr-3 text-right">Nutzen</th>}
            {!compact && <th className="py-2 pr-3 text-left">KPIs</th>}
            <th className="py-2 pl-2 pr-3 text-right">Aktionen</th>
          </tr>
        </thead>
        {group === "flat" ? (
          <tbody>
            {rows.map((r) => (
              <EpicListRowComponent
                key={r.id}
                row={r}
                canEdit={canEdit}
                canAdvance={canAdvance}
                stageGatesEnabled={stageGatesEnabled}
                selected={showSelection ? selectedIds!.has(r.id) : null}
                {...(onToggleSelect ? { onToggleSelect } : {})}
                compact={compact}
              />
            ))}
          </tbody>
        ) : (
          <StageGroupedBody
            rows={rows}
            canEdit={canEdit}
            canAdvance={canAdvance}
            stageGatesEnabled={stageGatesEnabled}
            selectedIds={selectedIds}
            {...(onToggleSelect ? { onToggleSelect } : {})}
            compact={compact}
          />
        )}
      </table>
    </div>
  );
}

interface StageGroupProps {
  rows: EpicListRow[];
  canEdit: boolean;
  canAdvance: boolean;
  stageGatesEnabled: boolean;
  selectedIds: Set<string> | null;
  onToggleSelect?: (id: string) => void;
  compact: boolean;
}

function StageGroupedBody({
  rows,
  canEdit,
  canAdvance,
  stageGatesEnabled,
  selectedIds,
  onToggleSelect,
  compact,
}: StageGroupProps) {
  // Open gates that hold filtered rows by default; collapse empty ones.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STAGE_GATES.map((g) => [g, rows.some((r) => r.stageGate === g)])),
  );
  const toggle = (g: string) => setOpen((prev) => ({ ...prev, [g]: !prev[g] }));

  const colCount = 1 + (selectedIds !== null ? 1 : 0) + (compact ? 3 : 7) + 1;

  return (
    <>
      {STAGE_GATES.map((gate) => {
        const gateRows = rows.filter((r) => r.stageGate === (gate as StageGate));
        const isOpen = open[gate] ?? false;
        return (
          <tbody key={gate}>
            <tr className="border-b bg-muted/30">
              <td colSpan={colCount} className="py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(gate)}
                  className="flex w-full items-center gap-2 px-3 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {STAGE_GATE_LABELS[gate] ?? gate}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {gateRows.length}
                  </span>
                </button>
              </td>
            </tr>
            {isOpen && gateRows.length === 0 && (
              <tr className="border-b">
                <td colSpan={colCount} className="py-2 pl-9 text-xs text-muted-foreground">
                  Keine Epics in diesem Gate
                </td>
              </tr>
            )}
            {isOpen &&
              gateRows.map((r) => (
                <EpicListRowComponent
                  key={r.id}
                  row={r}
                  canEdit={canEdit}
                  canAdvance={canAdvance}
                  stageGatesEnabled={stageGatesEnabled}
                  selected={selectedIds ? selectedIds.has(r.id) : null}
                  {...(onToggleSelect ? { onToggleSelect } : {})}
                  compact={compact}
                />
              ))}
          </tbody>
        );
      })}
    </>
  );
}
