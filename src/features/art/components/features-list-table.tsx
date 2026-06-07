"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FEATURE_STATUSES, type FeatureStatus } from "@/server/views/features-list";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";
import { FeatureListRowComponent } from "@/features/art/components/feature-list-row";
import type { FeatureListRow } from "@/server/views/features-list";

interface Props {
  rows: FeatureListRow[];
  canEdit: boolean;
  showWsjf: boolean;
  compact: boolean;
  group: "flat" | "status";
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
  onToggleSelectAll: ((ids: string[]) => void) | null;
}

/**
 * Feature backlog master table. Two grouping modes mirroring
 * `epics-list-table.tsx`:
 *
 * - **flat** — single sorted `<tbody>`. The dominant mode when the user
 *   is filtering / searching.
 * - **status** — four collapsible `<tbody>` sections per feature status
 *   (draft · approved · in_progress · completed). Useful for scanning
 *   the funnel rather than the metrics.
 *
 * Selection lives in the URL via the shell; the table emits clicks
 * upward via `onToggleSelect`.
 */
export function FeaturesListTable({
  rows,
  canEdit,
  showWsjf,
  compact,
  group,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Features gefunden — Filter anpassen oder ein neues anlegen.
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
            <th className="py-2 pr-3 text-left">Feature</th>
            {!compact && <th className="py-2 pr-3 text-left">Epic</th>}
            {!compact && <th className="py-2 pr-3 text-left">PI</th>}
            <th className="py-2 pr-3 text-left">Status</th>
            {!compact && showWsjf && <th className="py-2 pr-3 text-right">WSJF</th>}
            {!compact && <th className="py-2 pr-3 text-right">AC</th>}
            {canEdit && <th className="py-2 pl-2 pr-3 text-right">Aktionen</th>}
          </tr>
        </thead>
        {group === "flat" ? (
          <tbody>
            {rows.map((r) => (
              <FeatureListRowComponent
                key={r.id}
                row={r}
                canEdit={canEdit}
                selected={showSelection ? selectedIds!.has(r.id) : null}
                onToggleSelect={onToggleSelect ?? undefined}
                compact={compact}
              />
            ))}
          </tbody>
        ) : (
          <StatusGroupedBody
            rows={rows}
            canEdit={canEdit}
            showWsjf={showWsjf}
            compact={compact}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        )}
      </table>
    </div>
  );
}

function StatusGroupedBody({
  rows,
  canEdit,
  showWsjf,
  compact,
  selectedIds,
  onToggleSelect,
}: {
  rows: FeatureListRow[];
  canEdit: boolean;
  showWsjf: boolean;
  compact: boolean;
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_STATUSES.map((s) => [s, rows.some((r) => r.status === s)])),
  );
  const toggle = (s: string) => setOpen((prev) => ({ ...prev, [s]: !prev[s] }));

  const colCount =
    1 + (selectedIds !== null ? 1 : 0) + (compact ? 1 : showWsjf ? 4 : 3) + (canEdit ? 1 : 0);

  return (
    <>
      {FEATURE_STATUSES.map((status) => {
        const statusRows = rows.filter((r) => (r.status as FeatureStatus) === status);
        const isOpen = open[status] ?? false;
        return (
          <tbody key={status}>
            <tr className="border-b bg-muted/30">
              <td colSpan={colCount} className="py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(status)}
                  className="flex w-full items-center gap-2 px-3 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {statusRows.length}
                  </span>
                </button>
              </td>
            </tr>
            {isOpen && statusRows.length === 0 && (
              <tr className="border-b">
                <td colSpan={colCount} className="py-2 pl-9 text-xs text-muted-foreground">
                  Keine Features in diesem Status
                </td>
              </tr>
            )}
            {isOpen &&
              statusRows.map((r) => (
                <FeatureListRowComponent
                  key={r.id}
                  row={r}
                  canEdit={canEdit}
                  selected={selectedIds ? selectedIds.has(r.id) : null}
                  onToggleSelect={onToggleSelect ?? undefined}
                  compact={compact}
                />
              ))}
          </tbody>
        );
      })}
    </>
  );
}
