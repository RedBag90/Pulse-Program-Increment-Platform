"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DependenciesFunnelBar } from "@/features/dependencies/components/dependencies-funnel-bar";
import {
  DependenciesFilterBar,
  type ScopeFilter,
  type SortKey,
} from "@/features/dependencies/components/dependencies-filter-bar";
import { DependenciesListTable } from "@/features/dependencies/components/dependencies-list-table";
import { DependenciesBulkActionBar } from "@/features/dependencies/components/dependencies-bulk-action-bar";
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
function parseSelected(raw: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean).slice(0, 50));
}

/**
 * Dependencies list shell — owns URL state and the layout. Mirrors the
 * features / impediments / epics shells.
 */
export function DependenciesListShell({ model, artId, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = parseType(searchParams.get("type"));
  const featureId = searchParams.get("feature");
  const scope = parseScope(searchParams.get("scope"));
  const toStatus = searchParams.get("toStatus");
  const query = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));
  const group = parseGroup(searchParams.get("group"));
  const density = parseDensity(searchParams.get("density"));
  const selectedIds = parseSelected(searchParams.get("selected"));

  const pushParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  const setSelected = useCallback(
    (ids: Set<string>) => {
      const arr = [...ids].slice(0, 50);
      pushParam({ selected: arr.length === 0 ? null : arr.join(",") });
    },
    [pushParam],
  );
  const toggleSelect = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
    },
    [selectedIds, setSelected],
  );
  const toggleSelectAll = useCallback(
    (ids: string[]) => {
      const allSelected = ids.every((id) => selectedIds.has(id));
      const next = new Set(selectedIds);
      if (allSelected) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      setSelected(next);
    },
    [selectedIds, setSelected],
  );
  const clearSelected = useCallback(() => setSelected(new Set()), [setSelected]);

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
