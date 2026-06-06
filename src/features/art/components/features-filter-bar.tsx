"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EpicOption, PiOption, WsjfTier } from "@/server/views/features-list";

export type SortKey = "wsjf:desc" | "wsjf:asc" | "createdAt:desc" | "createdAt:asc" | "ac:desc";

interface Props {
  query: string;
  epicId: string | null;
  piId: string | null;
  tier: WsjfTier | null;
  sort: SortKey;
  group: "flat" | "status";
  density: "comfortable" | "compact";
  epicOptions: EpicOption[];
  piOptions: PiOption[];
  showWsjf: boolean;
  onQueryChange: (next: string) => void;
  onEpicChange: (next: string | null) => void;
  onPiChange: (next: string | null) => void;
  onTierChange: (next: WsjfTier | null) => void;
  onSortChange: (next: SortKey) => void;
  onGroupChange: (next: "flat" | "status") => void;
  onDensityChange: (next: "comfortable" | "compact") => void;
}

const SELECT =
  "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SORT_LABELS: Record<SortKey, string> = {
  "wsjf:desc": "WSJF ↓",
  "wsjf:asc": "WSJF ↑",
  "createdAt:desc": "Neueste zuerst",
  "createdAt:asc": "Älteste zuerst",
  "ac:desc": "AC-Anzahl ↓",
};

/**
 * Filter bar above the feature backlog table. Combines facet dropdowns
 * (Epic / PI / WSJF tier) with a debounced search input and the sort /
 * grouping / density controls. Mirrors `epics-filter-bar.tsx`.
 */
export function FeaturesFilterBar({
  query,
  epicId,
  piId,
  tier,
  sort,
  group,
  density,
  epicOptions,
  piOptions,
  showWsjf,
  onQueryChange,
  onEpicChange,
  onPiChange,
  onTierChange,
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

  const hasActiveFilter = epicId != null || piId != null || tier != null || query !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={SELECT}
        value={epicId ?? ""}
        onChange={(e) => onEpicChange(e.target.value || null)}
        aria-label="Epic"
      >
        <option value="">Alle Epics</option>
        {epicOptions.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={piId ?? ""}
        onChange={(e) => onPiChange(e.target.value || null)}
        aria-label="PI"
      >
        <option value="">Alle PIs</option>
        <option value="backlog">Backlog</option>
        {piOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {showWsjf && (
        <select
          className={SELECT}
          value={tier ?? ""}
          onChange={(e) => onTierChange((e.target.value as WsjfTier) || null)}
          aria-label="WSJF-Tier"
        >
          <option value="">Alle WSJF-Tiers</option>
          <option value="high">High (≥ 5)</option>
          <option value="medium">Medium (2–5)</option>
          <option value="low">Low (&lt; 2)</option>
          <option value="none">Ungescored</option>
        </select>
      )}

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
            onEpicChange(null);
            onPiChange(null);
            onTierChange(null);
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
            onClick={() => onGroupChange("status")}
            className={`px-2 py-1 ${
              group === "status" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
            }`}
            aria-pressed={group === "status"}
          >
            Status
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
