"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Target } from "lucide-react";
import { GoalsHeader, type StatusFilter } from "@/features/transformation/components/goals-header";
import { GoalList } from "@/features/transformation/components/goal-list";
import { GoalDetailPane } from "@/features/transformation/components/goal-detail-pane";
import { UnboundKpiDetailPane } from "@/features/transformation/components/unbound-kpi-detail-pane";
import {
  parseSelection,
  encodeSelection,
  type Selection,
} from "@/features/transformation/components/goals-selection";
import type { GoalsPageModel, GoalEditorView } from "@/server/views/transformation-goals";

interface Props {
  model: GoalsPageModel;
  canManage: boolean;
}

const STATUS_VALUES = new Set<StatusFilter>(["active", "achieved", "archived", "all"]);

function parseStatus(raw: string | null): StatusFilter {
  if (raw && STATUS_VALUES.has(raw as StatusFilter)) return raw as StatusFilter;
  return "active";
}

/**
 * Strategische-Ziele page shell. Owns the URL state (`?status=`, `?q=`,
 * `?selected=`) and the two-column layout. The list, header, and detail
 * panes are pure prop-driven — selection / filter writes go back through
 * this shell so the URL is the single source of truth.
 *
 * Layout:
 * - `lg+`: left list ~380 px, right pane fills the rest, sticky on scroll.
 * - `< lg`: stacks the list above the detail pane.
 */
export function GoalsPageShell({ model, canManage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const query = searchParams.get("q") ?? "";
  const selection = parseSelection(searchParams.get("selected"));

  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      // The route is computed at runtime; Next's typed-routes inference can't
      // narrow it. Casting via `as never` (Next docs' recommended escape).
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setStatus = useCallback(
    (next: StatusFilter) => pushParam("status", next === "active" ? null : next),
    [pushParam],
  );
  const setQuery = useCallback((next: string) => pushParam("q", next || null), [pushParam]);
  const setSelection = useCallback(
    (sel: Selection) => pushParam("selected", encodeSelection(sel)),
    [pushParam],
  );

  const onSelectGoal = useCallback(
    (id: string) => setSelection({ kind: "goal", id }),
    [setSelection],
  );
  const onSelectKpi = useCallback(
    (id: string) => setSelection({ kind: "kpi", id }),
    [setSelection],
  );
  const onNewGoal = useCallback(() => setSelection({ kind: "new" }), [setSelection]);
  const clearSelection = useCallback(() => setSelection({ kind: "none" }), [setSelection]);

  // Counts per status (pre-filter) — drive the chip badges.
  const counts = useMemo<Record<StatusFilter, number>>(() => {
    const c: Record<StatusFilter, number> = {
      active: 0,
      achieved: 0,
      archived: 0,
      all: model.goals.length,
    };
    for (const g of model.goals) {
      if (g.status === "active") c.active += 1;
      else if (g.status === "achieved") c.achieved += 1;
      else if (g.status === "archived") c.archived += 1;
    }
    return c;
  }, [model.goals]);

  // Filtered + searched goal list.
  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.goals.filter((g) => {
      if (status !== "all" && g.status !== status) return false;
      if (q === "") return true;
      if (g.title.toLowerCase().includes(q)) return true;
      if (g.description?.toLowerCase().includes(q)) return true;
      return g.kpis.some((k) => k.title.toLowerCase().includes(q));
    });
  }, [model.goals, status, query]);

  // Unbound KPI list also respects the search; the "Ohne Ziel" group only
  // shows on active or "all" filters (an unbound KPI has no goal status).
  const filteredUnboundKpis = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return model.unboundKpis;
    return model.unboundKpis.filter((k) => k.title.toLowerCase().includes(q));
  }, [model.unboundKpis, query]);
  const showUnbound = status === "active" || status === "all";

  // Resolve the currently-selected detail surface.
  const selectedGoal: GoalEditorView | null =
    selection.kind === "goal" ? (model.goals.find((g) => g.id === selection.id) ?? null) : null;
  const selectedKpi =
    selection.kind === "kpi"
      ? (model.unboundKpis.find((k) => k.id === selection.id) ?? null)
      : null;

  // If the user filters away from the selected goal's status, show a
  // dismissable pill above the list so the selection isn't silently lost.
  const selectedOutOfView =
    selectedGoal != null && status !== "all" && selectedGoal.status !== status;

  const activeGoals = useMemo(
    () => model.goals.filter((g) => g.status !== "archived"),
    [model.goals],
  );

  return (
    <div className="space-y-4 p-6">
      <GoalsHeader
        status={status}
        query={query}
        canManage={canManage}
        counts={counts}
        onStatusChange={setStatus}
        onQueryChange={setQuery}
        onNewGoal={onNewGoal}
      />

      {selectedOutOfView && (
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Ausgewähltes Ziel ist nicht im aktuellen Filter sichtbar.</span>
          <button
            type="button"
            onClick={() => setStatus("all")}
            className="font-medium underline hover:no-underline"
          >
            Filter zurücksetzen
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
          <GoalList
            goals={filteredGoals}
            unboundKpis={filteredUnboundKpis}
            showUnbound={showUnbound}
            userOptions={model.userOptions}
            selection={selection}
            onSelectGoal={onSelectGoal}
            onSelectKpi={onSelectKpi}
          />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {selection.kind === "new" ? (
            <GoalDetailPane
              goal={null}
              epicOptions={model.epicOptions}
              userOptions={model.userOptions}
              canManage={canManage}
              onCreated={clearSelection}
            />
          ) : selection.kind === "goal" && selectedGoal ? (
            <GoalDetailPane
              goal={selectedGoal}
              epicOptions={model.epicOptions}
              userOptions={model.userOptions}
              canManage={canManage}
              onDeleted={clearSelection}
            />
          ) : selection.kind === "kpi" && selectedKpi ? (
            <UnboundKpiDetailPane
              kpi={selectedKpi}
              goals={activeGoals}
              canManage={canManage}
              onAssigned={clearSelection}
              onDeleted={clearSelection}
            />
          ) : (
            <EmptyPane />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Target className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        Wähle ein Ziel oder eine KPI aus der Liste — oder lege ein neues Ziel an.
      </p>
    </div>
  );
}
