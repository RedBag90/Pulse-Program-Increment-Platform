"use client";

import { useCallback, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { useUrlSelection } from "@/lib/hooks/use-url-selection";
import { DependenciesFunnelBar } from "@/modules/drumbeat/features/dependencies/components/dependencies-funnel-bar";
import {
  DependenciesFilterBar,
  type ScopeFilter,
  type SortKey,
} from "@/modules/drumbeat/features/dependencies/components/dependencies-filter-bar";
import { DependenciesListTable } from "@/modules/drumbeat/features/dependencies/components/dependencies-list-table";
import { DependenciesBulkActionBar } from "@/modules/drumbeat/features/dependencies/components/dependencies-bulk-action-bar";
import {
  DEPENDENCY_TYPES,
  type DependencyType,
  type DependencyListRow,
  type DependenciesListModel,
} from "@/server/views/dependencies-list";

interface Props {
  model: DependenciesListModel;
  /** Used by the bulk-unlink action — the row's `from` ART would be more
   *  correct, but the page-level ART scope is the simplest gate that works
   *  with mixed-ART selections. Passing the active PI's owning ART. */
  artId: string;
  canEdit: boolean;
}

const TYPE_SET = new Set<string>(DEPENDENCY_TYPES);
const SCOPE_VALUES: ScopeFilter[] = ["all", "inPi", "crossPi"];
const SORT_KEYS: SortKey[] = ["createdAt:desc", "createdAt:asc", "daysOpen:desc"];

function parseType(raw: string | null): DependencyType | null {
  if (raw && TYPE_SET.has(raw)) return raw as DependencyType;
  return null;
}
function parseScope(raw: string | null): ScopeFilter {
  if (raw && SCOPE_VALUES.includes(raw as ScopeFilter)) return raw as ScopeFilter;
  return "all";
}
function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "createdAt:desc";
}
function parseGroup(raw: string | null): "flat" | "type" {
  return raw === "type" ? "type" : "flat";
}
function parseDensity(raw: string | null): "comfortable" | "compact" {
  return raw === "compact" ? "compact" : "comfortable";
}
/**
 * Dependencies list shell — owns URL state and the layout. Mirrors the
 * features / impediments / epics shells.
 */
export function DependenciesListShell({ model, artId, canEdit }: Props) {
  const { params, push: pushParam } = useUrlState();
  const { selectedIds, toggleSelect, toggleSelectAll, clearSelected } = useUrlSelection();

  const type = parseType(params.get("type"));
  const featureId = params.get("feature");
  const scope = parseScope(params.get("scope"));
  const toStatus = params.get("toStatus");
  const query = params.get("q") ?? "";
  const sort = parseSort(params.get("sort"));
  const group = parseGroup(params.get("group"));
  const density = parseDensity(params.get("density"));

  const onTypeChange = useCallback(
    (next: DependencyType | null) => pushParam({ type: next }),
    [pushParam],
  );
  const onFeatureChange = useCallback(
    (next: string | null) => pushParam({ feature: next }),
    [pushParam],
  );
  const onScopeChange = useCallback(
    (next: ScopeFilter) => pushParam({ scope: next === "all" ? null : next }),
    [pushParam],
  );
  const onToStatusChange = useCallback(
    (next: string | null) => pushParam({ toStatus: next }),
    [pushParam],
  );
  const onQueryChange = useCallback((next: string) => pushParam({ q: next || null }), [pushParam]);
  const onSortChange = useCallback(
    (next: SortKey) => pushParam({ sort: next === "createdAt:desc" ? null : next }),
    [pushParam],
  );
  const onGroupChange = useCallback(
    (next: "flat" | "type") => pushParam({ group: next === "flat" ? null : next }),
    [pushParam],
  );
  const onDensityChange = useCallback(
    (next: "comfortable" | "compact") =>
      pushParam({ density: next === "comfortable" ? null : next }),
    [pushParam],
  );

  const filteredRows: DependencyListRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = model.rows.filter((r) => {
      if (type != null && r.type !== type) return false;
      if (featureId && r.from.id !== featureId && r.to.id !== featureId) return false;
      if (scope === "inPi" && !(r.from.inPi && r.to.inPi)) return false;
      if (scope === "crossPi" && r.from.inPi && r.to.inPi) return false;
      if (toStatus && r.to.status !== toStatus) return false;
      if (q === "") return true;
      if (r.from.title.toLowerCase().includes(q)) return true;
      if (r.to.title.toLowerCase().includes(q)) return true;
      return false;
    });
    const sorted = filtered.slice();
    sorted.sort(compareBy(sort));
    return sorted;
  }, [model.rows, type, featureId, scope, toStatus, query, sort]);

  const selectedRows = useMemo(
    () => model.rows.filter((r) => selectedIds.has(r.id)),
    [model.rows, selectedIds],
  );

  return (
    <div className="space-y-4">
      <DependenciesFunnelBar
        counts={model.funnelCounts}
        activeType={type}
        onTypeChange={onTypeChange}
      />

      <DependenciesFilterBar
        query={query}
        featureId={featureId}
        scope={scope}
        toStatus={toStatus}
        sort={sort}
        group={group}
        density={density}
        featureOptions={model.featureOptions}
        toStatusOptions={model.toStatusOptions}
        onQueryChange={onQueryChange}
        onFeatureChange={onFeatureChange}
        onScopeChange={onScopeChange}
        onToStatusChange={onToStatusChange}
        onSortChange={onSortChange}
        onGroupChange={onGroupChange}
        onDensityChange={onDensityChange}
      />

      <DependenciesListTable
        rows={filteredRows}
        canEdit={canEdit}
        compact={density === "compact"}
        group={group}
        selectedIds={canEdit ? selectedIds : null}
        onToggleSelect={canEdit ? toggleSelect : null}
        onToggleSelectAll={canEdit ? toggleSelectAll : null}
      />

      {canEdit && (
        <DependenciesBulkActionBar
          selectedRows={selectedRows}
          artId={artId}
          onClear={clearSelected}
        />
      )}
    </div>
  );
}

function compareBy(sort: SortKey): (a: DependencyListRow, b: DependencyListRow) => number {
  switch (sort) {
    case "createdAt:asc":
      return (a, b) => a.createdAtMs - b.createdAtMs;
    case "daysOpen:desc":
      return (a, b) => b.daysOpen - a.daysOpen;
    case "createdAt:desc":
    default:
      return (a, b) => b.createdAtMs - a.createdAtMs;
  }
}
