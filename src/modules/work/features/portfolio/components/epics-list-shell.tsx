"use client";

import { useCallback, useMemo } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { useUrlSelection } from "@/lib/hooks/use-url-selection";
import { useKanbanRealtime } from "@/modules/work/features/portfolio/hooks/use-kanban-realtime";
import { CreateEpicDialog } from "@/modules/work/features/portfolio/components/create-epic-dialog";
import { EpicsFunnelBar } from "@/modules/work/features/portfolio/components/epics-funnel-bar";
import {
  EpicsFilterBar,
  type SortKey,
  type FlagFilter,
} from "@/modules/work/features/portfolio/components/epics-filter-bar";
import { EpicsListTable } from "@/modules/work/features/portfolio/components/epics-list-table";
import { EpicsBulkActionBar } from "@/modules/work/features/portfolio/components/epics-bulk-action-bar";
import type { EpicsListModel, EpicListRow } from "@/modules/work/server/views/portfolio-epics-list";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { EPIC_TYPES, HORIZONS } from "@/modules/work/domain/portfolio-guardrails";
import { matchesQuery } from "@/modules/work/lib/row-filter";

interface Props {
  model: EpicsListModel;
  canEdit: boolean;
  canSelect: boolean;
  tenantId: string;
}

const STAGE_GATE_SET = new Set<string>(STAGE_GATES);
const HORIZON_SET = new Set<string>(HORIZONS);
const EPIC_TYPE_SET = new Set<string>(EPIC_TYPES);
const SORT_KEYS: SortKey[] = [
  "createdAt:desc",
  "createdAt:asc",
  "cost:desc",
  "benefit:desc",
  "kpi:asc",
  "pending:desc",
];
const FLAG_VALUES: FlagFilter[] = ["all", "steering", "budgeting"];

function parseGate(raw: string | null): StageGate | null {
  if (raw && STAGE_GATE_SET.has(raw)) return raw as StageGate;
  return null;
}
function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.includes(raw as SortKey)) return raw as SortKey;
  return "createdAt:desc";
}
function parseFlag(raw: string | null): FlagFilter {
  if (raw && FLAG_VALUES.includes(raw as FlagFilter)) return raw as FlagFilter;
  return "all";
}
function parseHorizon(raw: string | null): string | null {
  return raw && HORIZON_SET.has(raw) ? raw : null;
}
function parseEpicType(raw: string | null): string | null {
  return raw && EPIC_TYPE_SET.has(raw) ? raw : null;
}
function parseGroup(raw: string | null): "flat" | "stage" {
  return raw === "stage" ? "stage" : "flat";
}
function parseDensity(raw: string | null): "comfortable" | "compact" {
  return raw === "compact" ? "compact" : "comfortable";
}
/**
 * Portfolio epics list shell — owns the URL state and the layout. Everything
 * below (funnel bar, filter bar, table, bulk action bar) is prop-driven; this
 * file is where filter + selection writes go back to the URL via
 * `router.replace`. Realtime updates from other users still flow via the
 * existing `useKanbanRealtime` subscription so concurrent moves on the
 * `/portfolio` board surface here too.
 */
export function EpicsListShell({ model, canEdit, canSelect, tenantId }: Props) {
  useKanbanRealtime(tenantId);
  const { params, push: pushParam } = useUrlState();
  const { selectedIds, toggleSelect, toggleSelectAll, clearSelected } = useUrlSelection();

  const gate = parseGate(params.get("gate"));
  const vsFilter = params.get("vs");
  const ownerFilter = params.get("owner");
  // Status-Filter ist seit dem Reifegrad-Modell v2 entfernt. Falls in einem
  // URL-Bookmark `?status=` noch existiert, wird er hier stillschweigend
  // ignoriert — keine Render-Effekt, keine Konsole-Warnung.
  const flag = parseFlag(params.get("flag"));
  const horizon = parseHorizon(params.get("horizon"));
  const epicType = parseEpicType(params.get("type"));
  const query = params.get("q") ?? "";
  const sort = parseSort(params.get("sort"));
  const group = parseGroup(params.get("group"));
  const density = parseDensity(params.get("density"));

  const onGateChange = useCallback(
    (next: StageGate | null) => pushParam({ gate: next }),
    [pushParam],
  );
  const onQueryChange = useCallback((next: string) => pushParam({ q: next || null }), [pushParam]);
  const onSortChange = useCallback(
    (next: SortKey) => pushParam({ sort: next === "createdAt:desc" ? null : next }),
    [pushParam],
  );
  const onGroupChange = useCallback(
    (next: "flat" | "stage") => pushParam({ group: next === "flat" ? null : next }),
    [pushParam],
  );
  const onDensityChange = useCallback(
    (next: "comfortable" | "compact") =>
      pushParam({ density: next === "comfortable" ? null : next }),
    [pushParam],
  );
  const onValueStreamChange = useCallback(
    (next: string | null) => pushParam({ vs: next }),
    [pushParam],
  );
  const onOwnerChange = useCallback(
    (next: string | null) => pushParam({ owner: next }),
    [pushParam],
  );
  const onFlagChange = useCallback(
    (next: FlagFilter) => pushParam({ flag: next === "all" ? null : next }),
    [pushParam],
  );
  const onHorizonChange = useCallback(
    (next: string | null) => pushParam({ horizon: next }),
    [pushParam],
  );
  const onEpicTypeChange = useCallback(
    (next: string | null) => pushParam({ type: next }),
    [pushParam],
  );

  // Filtered + sorted rows.
  const filteredRows: EpicListRow[] = useMemo(() => {
    const q = query.trim();
    const filtered = model.rows.filter((r) => {
      if (gate != null && r.stageGate !== gate) return false;
      if (vsFilter && r.valueStream?.id !== vsFilter) return false;
      if (ownerFilter && r.ownerId !== ownerFilter) return false;
      if (flag === "steering" && !r.needsSteeringAttention) return false;
      if (flag === "budgeting" && !r.stagedForBudgeting) return false;
      if (horizon != null && r.investmentHorizon !== horizon) return false;
      if (epicType != null && r.epicType !== epicType) return false;
      return matchesQuery([r.title, r.ownerLabel, r.valueStream?.name], q);
    });

    const sorted = filtered.slice();
    sorted.sort(compareBy(sort));
    return sorted;
  }, [model.rows, gate, vsFilter, ownerFilter, flag, horizon, epicType, query, sort]);

  const selectedRows = useMemo(
    () => model.rows.filter((r) => selectedIds.has(r.id)),
    [model.rows, selectedIds],
  );

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Epics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Das Portfolio-Backlog — Stage Gates, Ökonomie und Freigabe-Status auf einen Blick.
          </p>
        </div>
        {canEdit && (
          <CreateEpicDialog
            valueStreams={model.valueStreamOptions.map((v) => ({ id: v.id, name: v.name }))}
          />
        )}
      </header>

      <EpicsFunnelBar
        counts={model.funnelCounts}
        subStageCounts={model.subStageCounts}
        activeGate={gate}
        onGateChange={onGateChange}
      />

      <EpicsFilterBar
        query={query}
        valueStreamId={vsFilter}
        ownerId={ownerFilter}
        flag={flag}
        horizon={horizon}
        epicType={epicType}
        sort={sort}
        group={group}
        density={density}
        valueStreamOptions={model.valueStreamOptions}
        ownerOptions={model.ownerOptions}
        onQueryChange={onQueryChange}
        onValueStreamChange={onValueStreamChange}
        onOwnerChange={onOwnerChange}
        onFlagChange={onFlagChange}
        onHorizonChange={onHorizonChange}
        onEpicTypeChange={onEpicTypeChange}
        onSortChange={onSortChange}
        onGroupChange={onGroupChange}
        onDensityChange={onDensityChange}
      />

      <EpicsListTable
        rows={filteredRows}
        canEdit={canEdit}
        stageGatesEnabled={model.stageGatesEnabled}
        group={group}
        compact={density === "compact"}
        selectedIds={canSelect ? selectedIds : null}
        onToggleSelect={canSelect ? toggleSelect : null}
        onToggleSelectAll={canSelect ? toggleSelectAll : null}
      />

      {canSelect && <EpicsBulkActionBar selectedRows={selectedRows} onClear={clearSelected} />}
    </div>
  );
}

function compareBy(sort: SortKey): (a: EpicListRow, b: EpicListRow) => number {
  switch (sort) {
    case "createdAt:asc":
      return (a, b) => a.createdAtMs - b.createdAtMs;
    case "cost:desc":
      return (a, b) =>
        (b.economics.implementationCost ?? -1) - (a.economics.implementationCost ?? -1);
    case "benefit:desc":
      return (a, b) =>
        (b.economics.recurringBenefitYear ?? -1) - (a.economics.recurringBenefitYear ?? -1);
    case "kpi:asc":
      return (a, b) => (a.kpiProgress ?? 2) - (b.kpiProgress ?? 2);
    case "pending:desc":
      return (a, b) => b.pendingApprovalsCount - a.pendingApprovalsCount;
    case "createdAt:desc":
    default:
      return (a, b) => b.createdAtMs - a.createdAtMs;
  }
}
