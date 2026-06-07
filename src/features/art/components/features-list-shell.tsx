"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import { FeaturesFunnelBar } from "@/features/art/components/features-funnel-bar";
import { FeaturesFilterBar, type SortKey } from "@/features/art/components/features-filter-bar";
import { FeaturesListTable } from "@/features/art/components/features-list-table";
import { FeaturesBulkActionBar } from "@/features/art/components/features-bulk-action-bar";
import {
  FEATURE_STATUSES,
  type FeatureStatus,
  type FeatureListRow,
  type FeaturesListModel,
  type WsjfTier,
} from "@/server/views/features-list";

interface Props {
  model: FeaturesListModel;
  artId: string;
  canEdit: boolean;
}

const STATUS_SET = new Set<string>(FEATURE_STATUSES);
const SORT_KEYS: SortKey[] = [
  "wsjf:desc",
  "wsjf:asc",
  "createdAt:desc",
  "createdAt:asc",
  "ac:desc",
];
const TIER_VALUES: WsjfTier[] = ["high", "medium", "low", "none"];

function parseStatus(raw: string | null): FeatureStatus | null {
  if (raw && STATUS_SET.has(raw)) return raw as FeatureStatus;
  return null;
}
function parseSort(raw: string | null, defaultSort: SortKey): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return defaultSort;
}
function parseTier(raw: string | null): WsjfTier | null {
  if (raw && TIER_VALUES.includes(raw as WsjfTier)) return raw as WsjfTier;
  return null;
}
function parseGroup(raw: string | null): "flat" | "status" {
  return raw === "status" ? "status" : "flat";
}
function parseDensity(raw: string | null): "comfortable" | "compact" {
  return raw === "compact" ? "compact" : "comfortable";
}
function parseSelected(raw: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(raw.split(",").filter(Boolean).slice(0, 50));
}

/**
 * Feature backlog shell — owns URL state and the layout. Everything below
 * (funnel bar, filter bar, table, bulk action bar) is prop-driven; this
 * file is where filter + selection writes go back to the URL. Mirrors
 * `epics-list-shell.tsx`.
 */
export function FeaturesListShell({ model, artId, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const epicId = searchParams.get("epic");
  const piId = searchParams.get("pi");
  const tier = parseTier(searchParams.get("tier"));
  const query = searchParams.get("q") ?? "";
  const defaultSort: SortKey = model.showWsjf ? "wsjf:desc" : "createdAt:desc";
  const sort = parseSort(searchParams.get("sort"), defaultSort);
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

  const onStatusChange = useCallback(
    (next: FeatureStatus | null) => pushParam({ status: next }),
    [pushParam],
  );
  const onEpicChange = useCallback((next: string | null) => pushParam({ epic: next }), [pushParam]);
  const onPiChange = useCallback((next: string | null) => pushParam({ pi: next }), [pushParam]);
  const onTierChange = useCallback(
    (next: WsjfTier | null) => pushParam({ tier: next }),
    [pushParam],
  );
  const onQueryChange = useCallback((next: string) => pushParam({ q: next || null }), [pushParam]);
  const onSortChange = useCallback(
    (next: SortKey) => pushParam({ sort: next === defaultSort ? null : next }),
    [defaultSort, pushParam],
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

  const filteredRows: FeatureListRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = model.rows.filter((r) => {
      if (status != null && r.status !== status) return false;
      if (epicId && r.epic?.id !== epicId) return false;
      if (piId === "backlog" && r.pi != null) return false;
      if (piId && piId !== "backlog" && r.pi?.id !== piId) return false;
      if (tier != null && r.wsjfTier !== tier) return false;
      if (q === "") return true;
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.epic?.title.toLowerCase().includes(q)) return true;
      return false;
    });
    const sorted = filtered.slice();
    sorted.sort(compareBy(sort));
    return sorted;
  }, [model.rows, status, epicId, piId, tier, query, sort]);

  const selectedRows = useMemo(
    () => model.rows.filter((r) => selectedIds.has(r.id)),
    [model.rows, selectedIds],
  );

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Feature-Backlog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Features dieses ART — Status, WSJF und PI-Zuordnung auf einen Blick.
          </p>
        </div>
        {canEdit && <CreateFeatureDialog artId={artId} epics={model.epicOptions} />}
      </header>

      <FeaturesFunnelBar
        counts={model.funnelCounts}
        activeStatus={status}
        onStatusChange={onStatusChange}
      />

      <FeaturesFilterBar
        query={query}
        epicId={epicId}
        piId={piId}
        tier={tier}
        sort={sort}
        group={group}
        density={density}
        epicOptions={model.epicOptions}
        piOptions={model.piOptions}
        showWsjf={model.showWsjf}
        onQueryChange={onQueryChange}
        onEpicChange={onEpicChange}
        onPiChange={onPiChange}
        onTierChange={onTierChange}
        onSortChange={onSortChange}
        onGroupChange={onGroupChange}
        onDensityChange={onDensityChange}
      />

      <FeaturesListTable
        rows={filteredRows}
        canEdit={canEdit}
        showWsjf={model.showWsjf}
        compact={density === "compact"}
        group={group}
        selectedIds={canEdit ? selectedIds : null}
        onToggleSelect={canEdit ? toggleSelect : null}
        onToggleSelectAll={canEdit ? toggleSelectAll : null}
      />

      {canEdit && (
        <FeaturesBulkActionBar
          selectedRows={selectedRows}
          artId={artId}
          canEdit={canEdit}
          assignablePis={model.assignablePis}
          onClear={clearSelected}
        />
      )}
    </div>
  );
}

function compareBy(sort: SortKey): (a: FeatureListRow, b: FeatureListRow) => number {
  switch (sort) {
    case "wsjf:asc":
      return (a, b) => (a.wsjfComputed ?? -1) - (b.wsjfComputed ?? -1);
    case "createdAt:desc":
      return (a, b) => b.createdAtMs - a.createdAtMs;
    case "createdAt:asc":
      return (a, b) => a.createdAtMs - b.createdAtMs;
    case "ac:desc":
      return (a, b) => b.acceptanceCriteriaCount - a.acceptanceCriteriaCount;
    case "wsjf:desc":
    default:
      return (a, b) => (b.wsjfComputed ?? -1) - (a.wsjfComputed ?? -1);
  }
}
