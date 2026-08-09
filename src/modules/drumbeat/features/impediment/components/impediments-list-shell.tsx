"use client";

import { useCallback, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { useUrlSelection } from "@/lib/hooks/use-url-selection";
import { CreateImpedimentDialog } from "@/modules/drumbeat/features/impediment/components/create-impediment-dialog";
import { ImpedimentsFunnelBar } from "@/modules/drumbeat/features/impediment/components/impediments-funnel-bar";
import {
  ImpedimentsFilterBar,
  type SortKey,
} from "@/modules/drumbeat/features/impediment/components/impediments-filter-bar";
import { ImpedimentsListTable } from "@/modules/drumbeat/features/impediment/components/impediments-list-table";
import { ImpedimentsBulkActionBar } from "@/modules/drumbeat/features/impediment/components/impediments-bulk-action-bar";
import {
  IMPEDIMENT_STATUSES,
  IMPEDIMENT_SEVERITIES,
  type ImpedimentStatus,
  type ImpedimentSeverity,
  type ImpedimentListRow,
  type ImpedimentsListModel,
} from "@/server/views/impediments-list";

interface Props {
  model: ImpedimentsListModel;
  artId: string;
  canCreate: boolean;
  canEscalate: boolean;
  canResolve: boolean;
}

const STATUS_SET = new Set<string>(IMPEDIMENT_STATUSES);
const SEVERITY_SET = new Set<string>(IMPEDIMENT_SEVERITIES);
const SORT_KEYS: SortKey[] = ["daysOpen:desc", "daysOpen:asc", "severity:desc", "createdAt:desc"];
const SEVERITY_ORDER: Record<ImpedimentSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function parseStatus(raw: string | null): ImpedimentStatus | null {
  if (raw && STATUS_SET.has(raw)) return raw as ImpedimentStatus;
  return null;
}
function parseSeverity(raw: string | null): ImpedimentSeverity | null {
  if (raw && SEVERITY_SET.has(raw)) return raw as ImpedimentSeverity;
  return null;
}
function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "daysOpen:desc";
}
function parseGroup(raw: string | null): "flat" | "status" {
  return raw === "status" ? "status" : "flat";
}
function parseDensity(raw: string | null): "comfortable" | "compact" {
  return raw === "compact" ? "compact" : "comfortable";
}
/**
 * Impediment list shell — owns URL state and the layout. Mirrors the
 * features / epics shells.
 */
export function ImpedimentsListShell({ model, artId, canCreate, canEscalate, canResolve }: Props) {
  const { params, push: pushParam } = useUrlState();
  const { selectedIds, toggleSelect, toggleSelectAll, clearSelected } = useUrlSelection();

  const status = parseStatus(params.get("status"));
  const severity = parseSeverity(params.get("severity"));
  const ownerId = params.get("owner");
  const piId = params.get("pi");
  const query = params.get("q") ?? "";
  const sort = parseSort(params.get("sort"));
  const group = parseGroup(params.get("group"));
  const density = parseDensity(params.get("density"));

  const onStatusChange = useCallback(
    (next: ImpedimentStatus | null) => pushParam({ status: next }),
    [pushParam],
  );
  const onSeverityChange = useCallback(
    (next: ImpedimentSeverity | null) => pushParam({ severity: next }),
    [pushParam],
  );
  const onOwnerChange = useCallback(
    (next: string | null) => pushParam({ owner: next }),
    [pushParam],
  );
  const onPiChange = useCallback((next: string | null) => pushParam({ pi: next }), [pushParam]);
  const onQueryChange = useCallback((next: string) => pushParam({ q: next || null }), [pushParam]);
  const onSortChange = useCallback(
    (next: SortKey) => pushParam({ sort: next === "daysOpen:desc" ? null : next }),
    [pushParam],
  );
  const onGroupChange = useCallback(
    (next: "flat" | "status") => pushParam({ group: next === "flat" ? null : next }),
    [pushParam],
  );
  const onDensityChange = useCallback(
    (next: "comfortable" | "compact") =>
      pushParam({ density: next === "comfortable" ? null : next }),
    [pushParam],
  );

  const filteredRows: ImpedimentListRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = model.rows.filter((r) => {
      if (status != null && r.status !== status) return false;
      if (severity != null && r.severity !== severity) return false;
      if (ownerId && r.raisedById !== ownerId) return false;
      if (piId === "none" && r.piId != null) return false;
      if (piId && piId !== "none" && r.piId !== piId) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.description?.toLowerCase().includes(q)) return true;
      return false;
    });
    const sorted = filtered.slice();
    sorted.sort(compareBy(sort));
    return sorted;
  }, [model.rows, status, severity, ownerId, piId, query, sort]);

  const selectedRows = useMemo(
    () => model.rows.filter((r) => selectedIds.has(r.id)),
    [model.rows, selectedIds],
  );

  const canEdit = canEscalate || canResolve;

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Impediments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Blocker dieses ART — Schwere, Status und Tage offen auf einen Blick.
          </p>
        </div>
        {canCreate && <CreateImpedimentDialog artId={artId} />}
      </header>

      <ImpedimentsFunnelBar
        counts={model.funnelCounts}
        activeStatus={status}
        onStatusChange={onStatusChange}
      />

      <ImpedimentsFilterBar
        query={query}
        severity={severity}
        ownerId={ownerId}
        piId={piId}
        sort={sort}
        group={group}
        density={density}
        severityOptions={model.severityOptions}
        ownerOptions={model.ownerOptions}
        piOptions={model.piOptions}
        onQueryChange={onQueryChange}
        onSeverityChange={onSeverityChange}
        onOwnerChange={onOwnerChange}
        onPiChange={onPiChange}
        onSortChange={onSortChange}
        onGroupChange={onGroupChange}
        onDensityChange={onDensityChange}
      />

      <ImpedimentsListTable
        rows={filteredRows}
        artId={artId}
        canEscalate={canEscalate}
        canResolve={canResolve}
        compact={density === "compact"}
        group={group}
        selectedIds={canEdit ? selectedIds : null}
        onToggleSelect={canEdit ? toggleSelect : null}
        onToggleSelectAll={canEdit ? toggleSelectAll : null}
      />

      {canEdit && (
        <ImpedimentsBulkActionBar
          selectedRows={selectedRows}
          artId={artId}
          canEscalate={canEscalate}
          canResolve={canResolve}
          onClear={clearSelected}
        />
      )}
    </div>
  );
}

function compareBy(sort: SortKey): (a: ImpedimentListRow, b: ImpedimentListRow) => number {
  switch (sort) {
    case "daysOpen:asc":
      return (a, b) => a.daysOpen - b.daysOpen;
    case "severity:desc":
      return (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    case "createdAt:desc":
      return (a, b) => b.createdAtMs - a.createdAtMs;
    case "daysOpen:desc":
    default:
      return (a, b) => b.daysOpen - a.daysOpen;
  }
}
