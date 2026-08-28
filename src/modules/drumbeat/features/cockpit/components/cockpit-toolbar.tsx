"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import type {
  CockpitArtRef,
  CockpitFilters,
  CockpitModel,
  CockpitView,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { FEATURE_STATUS_LABELS } from "@/modules/drumbeat/domain/status";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { CockpitViewTabs } from "./cockpit-view-tabs";

/**
 * Eine Toolbar-Zeile fuer das Cockpit (Wireframe §6.2): ART-Scope · Sicht-Toggle
 * · Filter-Chips (Status · Owner · Epic · Nur Blocker) · Scope-Zaehler. Ersetzt
 * die zuvor getrennten Zeilen (Top-Bar-Filter + eigene View-Tabs-Zeile). Alle
 * Filter sind eigene URL-Params, ueberleben also den Sicht-Wechsel.
 */
const STATUS_ORDER: readonly FeatureStatus[] = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

interface Props {
  availableArts: CockpitArtRef[];
  selectedArt: CockpitArtRef | null;
  view: CockpitView;
  filters: CockpitFilters;
  filterOptions: CockpitModel["filterOptions"];
  featureCount: number;
}

export function CockpitToolbar({
  availableArts,
  selectedArt,
  view,
  filters,
  filterOptions,
  featureCount,
}: Props) {
  const { setParam } = useUrlState();

  // Freitext-Suche: lokaler State, debounced in `?q=` geschrieben — jeder
  // Tastenanschlag würde sonst einen Server-Roundtrip auslösen.
  const [query, setQuery] = useState(filters.q);
  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed !== filters.q.trim()) setParam("q", trimmed === "" ? null : trimmed);
    }, 300);
    return () => clearTimeout(id);
  }, [query, filters.q, setParam]);

  function toggleCsv(key: string, current: string[], value: string) {
    const set = new Set(current);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    setParam(key, set.size > 0 ? [...set].join(",") : null);
  }

  const artOptions: SearchSelectOption[] = availableArts.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.activeFeatureCount})`,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-surface-frame px-6 py-3">
      {availableArts.length > 1 ? (
        <SearchSelect
          value={selectedArt?.id ?? ""}
          onChange={(v) => setParam("art", v)}
          options={artOptions}
          placeholder="ART wählen"
          ariaLabel="ART auswählen"
          className="w-56"
        />
      ) : selectedArt ? (
        <span className="text-sm font-medium">
          {selectedArt.valueStreamName && (
            <>
              <span className="text-muted-foreground">{selectedArt.valueStreamName}</span>
              <span className="mx-1.5 text-muted-foreground/60">▸</span>
            </>
          )}
          {selectedArt.name}
        </span>
      ) : null}

      <CockpitViewTabs view={view} />

      <div className="relative min-w-48 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Feature suchen …"
          aria-label="Feature suchen"
          className="h-9 w-full rounded-md border bg-card pl-8 pr-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Status"
          sections={[
            { options: STATUS_ORDER.map((s) => ({ value: s, label: FEATURE_STATUS_LABELS[s] })) },
          ]}
          selected={new Set(filters.status)}
          onToggle={(v) => toggleCsv("status", filters.status, v)}
          onClear={() => setParam("status", null)}
        />
        <MultiSelectFilter
          label="Owner"
          sections={[{ options: filterOptions.owners }]}
          selected={new Set(filters.ownerIds)}
          onToggle={(v) => toggleCsv("owner", filters.ownerIds, v)}
          onClear={() => setParam("owner", null)}
          disabled={filterOptions.owners.length === 0}
        />
        <MultiSelectFilter
          label="Epic"
          sections={[{ options: filterOptions.epics }]}
          selected={new Set(filters.epicIds)}
          onToggle={(v) => toggleCsv("epic", filters.epicIds, v)}
          onClear={() => setParam("epic", null)}
          disabled={filterOptions.epics.length === 0}
        />
        <button
          type="button"
          onClick={() => setParam("blocker", filters.hasBlocker ? null : "1")}
          aria-pressed={filters.hasBlocker}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium ${
            filters.hasBlocker
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "bg-card text-muted-foreground hover:bg-muted/50"
          }`}
        >
          Nur Blocker
        </button>
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          {featureCount} Features im Scope
        </p>
      </div>
    </div>
  );
}
