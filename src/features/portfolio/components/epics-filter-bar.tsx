"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  EPIC_TYPES,
  HORIZONS,
  EPIC_TYPE_LABEL,
  HORIZON_LABEL,
} from "@/domain/portfolio-guardrails";

export type SortKey =
  | "createdAt:desc"
  | "createdAt:asc"
  | "cost:desc"
  | "benefit:desc"
  | "kpi:asc"
  | "pending:desc";

export type FlagFilter = "all" | "steering" | "budgeting";

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

const SELECT =
  "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SORT_LABELS: Record<SortKey, string> = {
  "createdAt:desc": "Neueste zuerst",
  "createdAt:asc": "Älteste zuerst",
  "cost:desc": "Kosten ↓",
  "benefit:desc": "Nutzen / Jahr ↓",
  "kpi:asc": "KPI-Fortschritt ↑",
  "pending:desc": "Offene Freigaben ↓",
};

/**
 * Filter bar above the table — combines facet dropdowns (Wertstrom · Owner ·
 * Flag) with a debounced search and the sort / grouping / density controls.
 * Status-Facette ist seit dem Reifegrad-Modell v2 entfallen: der Reifegrad-
 * Funnel (L0..L5) übernimmt die Höhere-Ebene-Filterung, und der status-
 * Workflow lebt in der Detail-Ansicht.
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
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, onQueryChange]);

  const hasActiveFilter =
    valueStreamId != null ||
    ownerId != null ||
    flag !== "all" ||
    horizon != null ||
    epicType != null ||
    query !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={SELECT}
        value={valueStreamId ?? ""}
        onChange={(e) => onValueStreamChange(e.target.value || null)}
        aria-label="Wertstrom"
      >
        <option value="">Alle Wertströme</option>
        {valueStreamOptions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={ownerId ?? ""}
        onChange={(e) => onOwnerChange(e.target.value || null)}
        aria-label="Owner"
      >
        <option value="">Alle Owner</option>
        {ownerOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={flag}
        onChange={(e) => onFlagChange(e.target.value as FlagFilter)}
        aria-label="Flag"
      >
        <option value="all">Alle Flags</option>
        <option value="steering">⚠ Steering</option>
        <option value="budgeting">💰 Budget</option>
      </select>

      <select
        className={SELECT}
        value={horizon ?? ""}
        onChange={(e) => onHorizonChange(e.target.value || null)}
        aria-label="Horizon"
      >
        <option value="">Alle Horizonte</option>
        {HORIZONS.map((h) => (
          <option key={h} value={h}>
            {HORIZON_LABEL[h]}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={epicType ?? ""}
        onChange={(e) => onEpicTypeChange(e.target.value || null)}
        aria-label="Epic-Typ"
      >
        <option value="">Alle Typen</option>
        {EPIC_TYPES.map((t) => (
          <option key={t} value={t}>
            {EPIC_TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Suche…"
          className="h-8 pl-7"
        />
      </div>

      {hasActiveFilter && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft("");
            onQueryChange("");
            onValueStreamChange(null);
            onOwnerChange(null);
            onFlagChange("all");
            onHorizonChange(null);
            onEpicTypeChange(null);
          }}
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <X className="size-3.5" /> Filter
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-muted-foreground">
          Sortierung
          <select
            className={SELECT}
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
    </div>
  );
}
