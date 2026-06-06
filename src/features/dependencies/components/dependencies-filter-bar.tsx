"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FeatureOption } from "@/server/views/dependencies-list";

export type ScopeFilter = "all" | "inPi" | "crossPi";
export type SortKey = "createdAt:desc" | "createdAt:asc" | "daysOpen:desc";

interface Props {
  query: string;
  featureId: string | null;
  scope: ScopeFilter;
  toStatus: string | null;
  sort: SortKey;
  group: "flat" | "type";
  density: "comfortable" | "compact";
  featureOptions: FeatureOption[];
  toStatusOptions: string[];
  onQueryChange: (next: string) => void;
  onFeatureChange: (next: string | null) => void;
  onScopeChange: (next: ScopeFilter) => void;
  onToStatusChange: (next: string | null) => void;
  onSortChange: (next: SortKey) => void;
  onGroupChange: (next: "flat" | "type") => void;
  onDensityChange: (next: "comfortable" | "compact") => void;
}

const SELECT =
  "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SORT_LABELS: Record<SortKey, string> = {
  "createdAt:desc": "Neueste zuerst",
  "createdAt:asc": "Älteste zuerst",
  "daysOpen:desc": "Tage offen ↓",
};

/**
 * Filter bar above the dependencies list. Feature dropdown + scope
 * (alle / nur im PI / cross-PI) + to-status filter + debounced search +
 * sort / group / density toggles.
 */
export function DependenciesFilterBar({
  query,
  featureId,
  scope,
  toStatus,
  sort,
  group,
  density,
  featureOptions,
  toStatusOptions,
  onQueryChange,
  onFeatureChange,
  onScopeChange,
  onToStatusChange,
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

  const hasActiveFilter = featureId != null || scope !== "all" || toStatus != null || query !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={SELECT}
        value={featureId ?? ""}
        onChange={(e) => onFeatureChange(e.target.value || null)}
        aria-label="Feature"
      >
        <option value="">Alle Features</option>
        {featureOptions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as ScopeFilter)}
        aria-label="PI-Bezug"
      >
        <option value="all">Alle</option>
        <option value="inPi">Nur im PI</option>
        <option value="crossPi">Cross-PI</option>
      </select>

      <select
        className={SELECT}
        value={toStatus ?? ""}
        onChange={(e) => onToStatusChange(e.target.value || null)}
        aria-label="Ziel-Status"
      >
        <option value="">Ziel: Alle Status</option>
        {toStatusOptions.map((s) => (
          <option key={s} value={s}>
            {s}
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
            onFeatureChange(null);
            onScopeChange("all");
            onToStatusChange(null);
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
            onClick={() => onGroupChange("type")}
            className={`px-2 py-1 ${
              group === "type" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={group === "type"}
          >
            Typ
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
