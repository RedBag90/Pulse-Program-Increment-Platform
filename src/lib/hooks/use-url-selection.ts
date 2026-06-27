"use client";

import { useCallback, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";

/**
 * URL-backed multi-select for list shells. Reads the `selected` search param
 * as a comma-separated id list (capped at `max`), and gives back a small
 * toolkit for toggling, batch-toggling, and clearing the selection. All
 * mutations round-trip through `useUrlState`, so navigation history stays
 * consistent with the other URL-as-state filters in the shell.
 *
 * Field-decoding stays the caller's concern in `useUrlState`; selection is
 * different — its encoding (CSV with a cap) is identical in every list shell
 * (impediments, dependencies, epics, my-tasks), so the hook owns it.
 *
 * Defaults: cap of 50 ids (mirrors the previous hand-rolled per-shell value).
 */
export function useUrlSelection(options?: { max?: number; paramKey?: string }): {
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (ids: readonly string[]) => void;
  clearSelected: () => void;
  setSelected: (ids: Set<string>) => void;
} {
  const max = options?.max ?? 50;
  const paramKey = options?.paramKey ?? "selected";
  const { params, push } = useUrlState();

  const raw = params.get(paramKey);
  const selectedIds = useMemo<Set<string>>(() => {
    if (!raw) return new Set();
    return new Set(raw.split(",").filter(Boolean).slice(0, max));
  }, [raw, max]);

  const setSelected = useCallback(
    (ids: Set<string>) => {
      const arr = [...ids].slice(0, max);
      push({ [paramKey]: arr.length === 0 ? null : arr.join(",") });
    },
    [push, max, paramKey],
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
    (ids: readonly string[]) => {
      const allSelected = ids.every((id) => selectedIds.has(id));
      const next = new Set(selectedIds);
      if (allSelected) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      setSelected(next);
    },
    [selectedIds, setSelected],
  );

  const clearSelected = useCallback(() => setSelected(new Set()), [setSelected]);

  return { selectedIds, toggleSelect, toggleSelectAll, clearSelected, setSelected };
}
