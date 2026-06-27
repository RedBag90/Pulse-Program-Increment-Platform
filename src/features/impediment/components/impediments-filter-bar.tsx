"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import type { ImpedimentSeverity, OwnerOption, PiOption } from "@/server/views/impediments-list";

export type SortKey = "daysOpen:desc" | "daysOpen:asc" | "severity:desc" | "createdAt:desc";

interface Props {
  query: string;
  severity: ImpedimentSeverity | null;
  ownerId: string | null;
  piId: string | null;
  sort: SortKey;
  group: "flat" | "status";
  density: "comfortable" | "compact";
  severityOptions: ImpedimentSeverity[];
  ownerOptions: OwnerOption[];
  piOptions: PiOption[];
  onQueryChange: (next: string) => void;
  onSeverityChange: (next: ImpedimentSeverity | null) => void;
  onOwnerChange: (next: string | null) => void;
  onPiChange: (next: string | null) => void;
  onSortChange: (next: SortKey) => void;
  onGroupChange: (next: "flat" | "status") => void;
  onDensityChange: (next: "comfortable" | "compact") => void;
}

const SELECT =
  "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SEVERITY_LABEL: Record<ImpedimentSeverity, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

const SORT_LABELS: Record<SortKey, string> = {
  "daysOpen:desc": "Tage offen ↓",
  "daysOpen:asc": "Tage offen ↑",
  "severity:desc": "Schwere ↓",
  "createdAt:desc": "Neueste zuerst",
};

/**
 * Filter bar above the impediment list. Mirrors the features/epics shape:
 * severity / PI / owner facets + 200ms-debounced search + sort dropdown +
 * group toggle + density toggle.
 */
export function ImpedimentsFilterBar({
  query,
  severity,
  ownerId,
  piId,
  sort,
  group,
  density,
  severityOptions,
  ownerOptions,
  piOptions,
  onQueryChange,
  onSeverityChange,
  onOwnerChange,
  onPiChange,
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

  const hasActiveFilter = severity != null || ownerId != null || piId != null || query !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={SELECT}
        value={severity ?? ""}
        onChange={(e) => onSeverityChange((e.target.value as ImpedimentSeverity) || null)}
        aria-label="Schwere"
      >
        <option value="">Alle Schweregrade</option>
        {severityOptions.map((s) => (
          <option key={s} value={s}>
            {SEVERITY_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={ownerId ?? ""}
        onChange={(e) => onOwnerChange(e.target.value || null)}
        aria-label="Erfasst von"
      >
        <option value="">Alle Erfasser:innen</option>
        {ownerOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
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
        <option value="none">Ohne PI</option>
        {piOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
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
            onSeverityChange(null);
            onOwnerChange(null);
            onPiChange(null);
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
            { id: "status", label: "Status" },
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
