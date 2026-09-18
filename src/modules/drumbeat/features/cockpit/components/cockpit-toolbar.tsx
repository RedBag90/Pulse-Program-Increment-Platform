"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useUrlState } from "@/modules/drumbeat/features/lib/use-url-state";
import type {
  CockpitFilters,
  CockpitModel,
  CockpitView,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import { FEATURE_STATUS_LABELS } from "@/modules/drumbeat/domain/status";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { CockpitViewTabs } from "./cockpit-view-tabs";

/**
 * **Was sehe ich davon** — Sicht-Umschalter, Suche und Facetten.
 *
 * Das Cockpit hatte vier gestapelte graue Bänder, in denen Scope, Filter und
 * Governance gleich aussahen: der ART-Wähler stand zwischen den Sicht-Reitern
 * und den Filter-Chips, die PI-Wahl zwei Bänder weiter oben. Diese Leiste trägt
 * jetzt nur noch **eine** Frage; wo man ist, sagt der Kopf, welcher Zeitraum
 * gilt, sagt der Streifen.
 *
 * Alle Facetten sind eigene URL-Params und überleben den Sicht-Wechsel.
 */
const STATUS_ORDER: readonly FeatureStatus[] = [
  "approved",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

interface Props {
  view: CockpitView;
  filters: CockpitFilters;
  filterOptions: CockpitModel["filterOptions"];
  featureCount: number;
}

export function CockpitToolbar({ view, filters, filterOptions, featureCount }: Props) {
  const { setParam, setParams } = useUrlState();

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

  // Ein Filter ist an, sobald eine Facette etwas eingrenzt. Die Suche zählt mit
  // — sie ist der Filter, den man am leichtesten vergisst.
  const activeFilters =
    filters.status.length +
    filters.ownerIds.length +
    filters.epicIds.length +
    (filters.hasBlocker ? 1 : 0) +
    (filters.q.trim() !== "" ? 1 : 0);

  function resetAll() {
    setQuery("");
    setParams({ status: null, owner: null, epic: null, blocker: null, q: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-surface-frame px-6 py-3">
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
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Filter zurücksetzen
          </button>
        )}
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          {featureCount} {featureCount === 1 ? "Feature" : "Features"}
          {activeFilters > 0 ? " gefiltert" : " im Scope"}
        </p>
      </div>
    </div>
  );
}
