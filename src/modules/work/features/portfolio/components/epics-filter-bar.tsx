"use client";

import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  EpicFacetFilterBar,
  FACET_SELECT_CLASS,
  type FlagFilter,
} from "@/modules/work/features/portfolio/components/epic-facet-filter-bar";

export type SortKey =
  | "createdAt:desc"
  | "createdAt:asc"
  | "cost:desc"
  | "benefit:desc"
  | "kpi:asc"
  | "pending:desc";

// Die Facetten-Zeile (inkl. FlagFilter) lebt in `epic-facet-filter-bar` und wird
// auch vom Portfolio-Dashboard genutzt; re-exportiert für bestehende Importer.
export type { FlagFilter } from "@/modules/work/features/portfolio/components/epic-facet-filter-bar";

interface Props {
  query: string;
  valueStreamId: string | null;
  ownerId: string | null;
  flag: FlagFilter;
  /** SAFe-Guardrail-Filter (Roadmap-G3). null = nicht gesetzt. */
  horizon: string | null;
  epicType: string | null;
  sort: SortKey;
  group: "flat" | "stage";
  density: "comfortable" | "compact";
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  onQueryChange: (next: string) => void;
  onValueStreamChange: (next: string | null) => void;
  onOwnerChange: (next: string | null) => void;
  onFlagChange: (next: FlagFilter) => void;
  onHorizonChange: (next: string | null) => void;
  onEpicTypeChange: (next: string | null) => void;
  onSortChange: (next: SortKey) => void;
  onGroupChange: (next: "flat" | "stage") => void;
  onDensityChange: (next: "comfortable" | "compact") => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  "createdAt:desc": "Neueste zuerst",
  "createdAt:asc": "Älteste zuerst",
  "cost:desc": "Kosten ↓",
  "benefit:desc": "Nutzen / Jahr ↓",
  "kpi:asc": "KPI-Fortschritt ↑",
  "pending:desc": "Offene Freigaben ↓",
};

/**
 * Filter bar above the table — the shared facet row (`EpicFacetFilterBar`:
 * Wertstrom · Owner · Flag · Horizont · Typ · Suche) plus the list-only sort /
 * grouping / density controls. Status-Facette ist seit dem Reifegrad-Modell v2
 * entfallen: der Reifegrad-Funnel (L0..L5) übernimmt die Höhere-Ebene-
 * Filterung, und der status-Workflow lebt in der Detail-Ansicht.
 */
export function EpicsFilterBar({
  query,
  valueStreamId,
  ownerId,
  flag,
  horizon,
  epicType,
  sort,
  group,
  density,
  valueStreamOptions,
  ownerOptions,
  onQueryChange,
  onValueStreamChange,
  onOwnerChange,
  onFlagChange,
  onHorizonChange,
  onEpicTypeChange,
  onSortChange,
  onGroupChange,
  onDensityChange,
}: Props) {
  return (
    <EpicFacetFilterBar
      query={query}
      valueStreamId={valueStreamId}
      ownerId={ownerId}
      flag={flag}
      horizon={horizon}
      epicType={epicType}
      valueStreamOptions={valueStreamOptions}
      ownerOptions={ownerOptions}
      onQueryChange={onQueryChange}
      onValueStreamChange={onValueStreamChange}
      onOwnerChange={onOwnerChange}
      onFlagChange={onFlagChange}
      onHorizonChange={onHorizonChange}
      onEpicTypeChange={onEpicTypeChange}
    >
      <div className="ml-auto flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-muted-foreground">
          Sortierung
          <select
            className={FACET_SELECT_CLASS}
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            aria-label="Sortierung"
          >
            {Object.entries(SORT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <ToggleGroup
          value={group}
          options={[
            { id: "flat", label: "Liste" },
            { id: "stage", label: "Funnel" },
          ]}
          onChange={onGroupChange}
          ariaLabel="Gruppierung"
        />

        <ToggleGroup
          value={density}
          options={[
            { id: "comfortable", label: "Komfort" },
            { id: "compact", label: "Kompakt" },
          ]}
          onChange={onDensityChange}
          ariaLabel="Zeilenhoehe"
        />
      </div>
    </EpicFacetFilterBar>
  );
}
