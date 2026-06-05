"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/components/detail/initiative-labels";

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
  status: string | null;
  flag: FlagFilter;
  sort: SortKey;
  group: "flat" | "stage";
  density: "comfortable" | "compact";
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  statusOptions: string[];
  onQueryChange: (next: string) => void;
  onValueStreamChange: (next: string | null) => void;
  onOwnerChange: (next: string | null) => void;
  onStatusChange: (next: string | null) => void;
  onFlagChange: (next: FlagFilter) => void;
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
 * Status · Flag) with a debounced search and the sort / grouping / density
 * controls. Every choice is URL-state; the shell handles the writes, this
 * component only renders and emits.
 */
export function EpicsFilterBar({
  query,
  valueStreamId,
  ownerId,
  status,
  flag,
  sort,
  group,
  density,
  valueStreamOptions,
  ownerOptions,
  statusOptions,
  onQueryChange,
  onValueStreamChange,
  onOwnerChange,
  onStatusChange,
  onFlagChange,
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
    valueStreamId != null || ownerId != null || status != null || flag !== "all" || query !== "";

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
        value={status ?? ""}
        onChange={(e) => onStatusChange(e.target.value || null)}
        aria-label="Status"
      >
        <option value="">Alle Status</option>
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s] ?? s}
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
            onStatusChange(null);
            onFlagChange("all");
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

        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => onGroupChange("flat")}
            className={`px-2 py-1 ${
              group === "flat" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={group === "flat"}
          >
            Liste
          </button>
          <button
            type="button"
            onClick={() => onGroupChange("stage")}
            className={`px-2 py-1 ${
              group === "stage" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={group === "stage"}
          >
            Funnel
          </button>
        </div>

        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => onDensityChange("comfortable")}
            className={`px-2 py-1 ${
              density === "comfortable" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={density === "comfortable"}
          >
            Komfort
          </button>
          <button
            type="button"
            onClick={() => onDensityChange("compact")}
            className={`px-2 py-1 ${
              density === "compact" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={density === "compact"}
          >
            Kompakt
          </button>
        </div>
      </div>
    </div>
  );
}
