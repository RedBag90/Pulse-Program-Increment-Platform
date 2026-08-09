"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { IMPEDIMENT_STATUSES, type ImpedimentStatus } from "@/server/views/impediments-list";
import { ImpedimentListRowComponent } from "@/modules/drumbeat/features/impediment/components/impediment-list-row";
import type { ImpedimentListRow } from "@/server/views/impediments-list";

interface Props {
  rows: ImpedimentListRow[];
  artId: string;
  canEscalate: boolean;
  canResolve: boolean;
  compact: boolean;
  group: "flat" | "status";
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
  onToggleSelectAll: ((ids: string[]) => void) | null;
}

const STATUS_LABEL: Record<ImpedimentStatus, string> = {
  open: "Offen",
  escalated: "Eskaliert",
  resolved: "Aufgelöst",
};

/**
 * Impediments master table. Mirrors the features / epics tables — two
 * grouping modes (flat sorted vs collapsible per-status sections).
 */
export function ImpedimentsListTable({
  rows,
  artId,
  canEscalate,
  canResolve,
  compact,
  group,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Impediments gefunden — Filter anpassen oder ein neues erfassen.
      </div>
    );
  }

  const showSelection = selectedIds !== null;
  const canEdit = canEscalate || canResolve;
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
            {!compact && <th className="py-2 pr-3 text-left">Erfasst von</th>}
            {!compact && <th className="py-2 pr-3 text-left">PI</th>}
            <th className="py-2 pr-3 text-left">Schwere</th>
            <th className="py-2 pr-3 text-left">Status</th>
            {!compact && <th className="py-2 pr-3 text-right">Tage offen</th>}
            {!compact && <th className="py-2 pr-3 text-right">Eskaliert seit</th>}
            {canEdit && <th className="py-2 pl-2 pr-3 text-right">Aktionen</th>}
          </tr>
        </thead>
        {group === "flat" ? (
          <tbody>
            {rows.map((r) => (
              <ImpedimentListRowComponent
                key={r.id}
                row={r}
                artId={artId}
                canEscalate={canEscalate}
                canResolve={canResolve}
                selected={showSelection ? selectedIds!.has(r.id) : null}
                onToggleSelect={onToggleSelect ?? undefined}
                compact={compact}
              />
            ))}
          </tbody>
        ) : (
          <StatusGroupedBody
            rows={rows}
            artId={artId}
            canEscalate={canEscalate}
            canResolve={canResolve}
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
  artId,
  canEscalate,
  canResolve,
  compact,
  selectedIds,
  onToggleSelect,
}: {
  rows: ImpedimentListRow[];
  artId: string;
  canEscalate: boolean;
  canResolve: boolean;
  compact: boolean;
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(IMPEDIMENT_STATUSES.map((s) => [s, rows.some((r) => r.status === s)])),
  );
  const toggle = (s: string) => setOpen((prev) => ({ ...prev, [s]: !prev[s] }));

  const canEdit = canEscalate || canResolve;
  const colCount = 1 + (selectedIds !== null ? 1 : 0) + (compact ? 2 : 6) + (canEdit ? 1 : 0);

  return (
    <>
      {IMPEDIMENT_STATUSES.map((status) => {
        const statusRows = rows.filter((r) => r.status === status);
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
                    {STATUS_LABEL[status]}
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
                  Keine Einträge in diesem Status
                </td>
              </tr>
            )}
            {isOpen &&
              statusRows.map((r) => (
                <ImpedimentListRowComponent
                  key={r.id}
                  row={r}
                  artId={artId}
                  canEscalate={canEscalate}
                  canResolve={canResolve}
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
