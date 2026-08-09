"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DEPENDENCY_TYPES, type DependencyType } from "@/server/views/dependencies-list";
import { DependencyListRowComponent } from "@/modules/drumbeat/features/dependencies/components/dependency-list-row";
import type { DependencyListRow } from "@/server/views/dependencies-list";

interface Props {
  rows: DependencyListRow[];
  canEdit: boolean;
  compact: boolean;
  group: "flat" | "type";
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
  onToggleSelectAll: ((ids: string[]) => void) | null;
}

const TYPE_LABEL: Record<DependencyType, string> = {
  blocks: "Blockiert",
  depends_on: "Hängt ab von",
  relates_to: "Bezieht sich auf",
};

/**
 * Dependencies master table. Two grouping modes mirroring the features +
 * impediments tables — flat sorted or per-type collapsible sections.
 */
export function DependenciesListTable({
  rows,
  canEdit,
  compact,
  group,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Keine Abhängigkeiten gefunden — Filter anpassen oder Features im Detail verknüpfen.
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
            <th className="py-2 pr-3 text-left">Von → Zu</th>
            <th className="py-2 pr-3 text-left">Typ</th>
            <th className="py-2 pr-3 text-left">Ziel-Status</th>
            {!compact && <th className="py-2 pr-3 text-right">Tage offen</th>}
          </tr>
        </thead>
        {group === "flat" ? (
          <tbody>
            {rows.map((r) => (
              <DependencyListRowComponent
                key={r.id}
                row={r}
                selected={showSelection ? selectedIds!.has(r.id) : null}
                onToggleSelect={onToggleSelect ?? undefined}
                compact={compact}
              />
            ))}
          </tbody>
        ) : (
          <TypeGroupedBody
            rows={rows}
            canEdit={canEdit}
            compact={compact}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        )}
      </table>
    </div>
  );
}

function TypeGroupedBody({
  rows,
  compact,
  selectedIds,
  onToggleSelect,
}: {
  rows: DependencyListRow[];
  canEdit: boolean;
  compact: boolean;
  selectedIds: Set<string> | null;
  onToggleSelect: ((id: string) => void) | null;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEPENDENCY_TYPES.map((t) => [t, rows.some((r) => r.type === t)])),
  );
  const toggle = (t: string) => setOpen((prev) => ({ ...prev, [t]: !prev[t] }));

  const colCount = 1 + (selectedIds !== null ? 1 : 0) + (compact ? 2 : 3);

  return (
    <>
      {DEPENDENCY_TYPES.map((type) => {
        const typeRows = rows.filter((r) => r.type === type);
        const isOpen = open[type] ?? false;
        return (
          <tbody key={type}>
            <tr className="border-b bg-muted/30">
              <td colSpan={colCount} className="py-1.5">
                <button
                  type="button"
                  onClick={() => toggle(type)}
                  className="flex w-full items-center gap-2 px-3 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {TYPE_LABEL[type]}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {typeRows.length}
                  </span>
                </button>
              </td>
            </tr>
            {isOpen && typeRows.length === 0 && (
              <tr className="border-b">
                <td colSpan={colCount} className="py-2 pl-9 text-xs text-muted-foreground">
                  Keine Einträge dieses Typs
                </td>
              </tr>
            )}
            {isOpen &&
              typeRows.map((r) => (
                <DependencyListRowComponent
                  key={r.id}
                  row={r}
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
