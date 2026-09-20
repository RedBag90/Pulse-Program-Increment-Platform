"use client";

import { useEffect, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { SearchSelect } from "@/components/ui/search-select";
import { CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";
import {
  ISSUE_GROUP_AXES,
  ISSUE_GROUP_LABELS,
  type IssueGroupAxis,
} from "@/modules/risks/domain/issue-grouping";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";
import {
  EXPOSURE_BANDS,
  EXPOSURE_LABEL,
  EXPOSURE_TONE,
} from "@/modules/core/kernel/domain/exposure";

export type IssueSortKey = "created:desc" | "daysOpen:desc" | "exposure:desc" | "title:asc";
export type IssueDensity = "comfortable" | "compact";

const SORT_LABELS: Record<IssueSortKey, string> = {
  "created:desc": "Neueste zuerst",
  "daysOpen:desc": "Am längsten offen",
  "exposure:desc": "Höchste Exposure",
  "title:asc": "Titel A–Z",
};

interface Props {
  query: string;
  /**
   * Die ROAM-Auswahl gehört der Chip-Leiste, nicht dieser hier — sie steht
   * trotzdem in den Props: „Zurücksetzen" räumt sie mit ab und muss deshalb
   * auch erscheinen, wenn **nur** ein Chip aktiv ist.
   */
  roams: string[];
  categories: string[];
  owners: string[];
  bands: string[];
  valueStreams: string[];
  arts: string[];
  sort: IssueSortKey;
  density: IssueDensity;
  categoryOptions: string[];
  ownerOptions: { id: string; label: string }[];
  valueStreamOptions: { id: string; label: string }[];
  artOptions: { id: string; label: string }[];
  onQueryChange: (v: string) => void;
  onCategoriesChange: (v: string[]) => void;
  onOwnersChange: (v: string[]) => void;
  onBandsChange: (v: string[]) => void;
  onValueStreamsChange: (v: string[]) => void;
  onArtsChange: (v: string[]) => void;
  /**
   * Alles zurücksetzen — **ein** Schreibvorgang in die URL statt sechs, und mit
   * dem Marker „bewusst leer", damit der gespeicherte Standard-Filter beim
   * nächsten Öffnen nicht sofort wieder zuschlägt.
   */
  onClearAll: () => void;
  onSortChange: (v: IssueSortKey) => void;
  onDensityChange: (v: IssueDensity) => void;
  group: IssueGroupAxis;
  onGroupChange: (v: IssueGroupAxis) => void;
  /**
   * Die Baum-Schalter — nur da, wenn es überhaupt einen Head mit Kindern gibt.
   * Zwei Knöpfe wie im Ziele-Baum, jeder im erreichten Zustand `disabled`.
   */
  tree?: {
    alleAuf: boolean;
    alleZu: boolean;
    onAlleAuf: () => void;
    onAlleZu: () => void;
  };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Eine Filter-Toolbar für das Issue-Register: Suche · Kategorie · Owner · Band ·
 * Sortierung · Dichte. Multi-Select über das geteilte `MultiSelectFilter`
 * (a11y-Popover) statt nativer `<select>` — Mehrfach-Filter ist damit möglich.
 */
export function IssuesFilterBar(p: Props) {
  const [draft, setDraft] = useState(p.query);
  useEffect(() => setDraft(p.query), [p.query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== p.query) p.onQueryChange(draft);
    }, 200);
    return () => clearTimeout(t);
  }, [draft, p]);

  const hasActiveFilter =
    p.categories.length > 0 ||
    p.owners.length > 0 ||
    p.bands.length > 0 ||
    p.valueStreams.length > 0 ||
    p.arts.length > 0 ||
    p.roams.length > 0 ||
    p.query !== "";
  const clearAll = () => {
    setDraft("");
    p.onClearAll();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Issue suchen …"
          aria-label="Issue suchen"
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <MultiSelectFilter
        label="Kategorie"
        sections={[
          {
            options: p.categoryOptions.map((c) => ({
              value: c,
              label: CATEGORY_LABELS[c as RiskCategory] ?? c,
            })),
          },
        ]}
        selected={new Set(p.categories)}
        onToggle={(v) => p.onCategoriesChange(toggle(p.categories, v))}
        onClear={() => p.onCategoriesChange([])}
        disabled={p.categoryOptions.length === 0}
      />

      <MultiSelectFilter
        label="Owner"
        sections={[{ options: p.ownerOptions.map((o) => ({ value: o.id, label: o.label })) }]}
        selected={new Set(p.owners)}
        onToggle={(v) => p.onOwnersChange(toggle(p.owners, v))}
        onClear={() => p.onOwnersChange([])}
        disabled={p.ownerOptions.length === 0}
      />

      {/* „Exposure", nicht „Band": die Spalte daneben, die Sortierung und die
          Matrix-Legende sagen alle Exposure — ein Wort je Größe. */}
      <MultiSelectFilter
        label="Exposure"
        sections={[
          {
            options: EXPOSURE_BANDS.map((b) => ({
              value: b,
              label: EXPOSURE_LABEL[b],
              color: EXPOSURE_TONE[b].hex,
            })),
          },
        ]}
        selected={new Set(p.bands)}
        onToggle={(v) => p.onBandsChange(toggle(p.bands, v))}
        onClear={() => p.onBandsChange([])}
      />

      <MultiSelectFilter
        label="Wertstrom"
        sections={[{ options: p.valueStreamOptions.map((o) => ({ value: o.id, label: o.label })) }]}
        selected={new Set(p.valueStreams)}
        onToggle={(v) => p.onValueStreamsChange(toggle(p.valueStreams, v))}
        onClear={() => p.onValueStreamsChange([])}
        disabled={p.valueStreamOptions.length === 0}
      />

      <MultiSelectFilter
        label="ART"
        sections={[{ options: p.artOptions.map((o) => ({ value: o.id, label: o.label })) }]}
        selected={new Set(p.arts)}
        onToggle={(v) => p.onArtsChange(toggle(p.arts, v))}
        onClear={() => p.onArtsChange([])}
        disabled={p.artOptions.length === 0}
      />

      {hasActiveFilter && (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1 size-3.5" />
          Zurücksetzen
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {p.tree && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={p.tree.onAlleAuf}
              disabled={p.tree.alleAuf}
              aria-label="Alle aufklappen"
              title="Alle aufklappen"
            >
              <ChevronsUpDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={p.tree.onAlleZu}
              disabled={p.tree.alleZu}
              aria-label="Alle zuklappen"
              title="Alle zuklappen"
            >
              <ChevronsDownUp className="size-3.5" />
            </Button>
          </div>
        )}
        <SearchSelect
          value={p.group}
          onChange={(v) => p.onGroupChange(v as IssueGroupAxis)}
          options={ISSUE_GROUP_AXES.map((a) => ({
            value: a,
            label: `Gruppen: ${ISSUE_GROUP_LABELS[a]}`,
          }))}
          placeholder="Gruppierung"
          ariaLabel="Gruppierung"
          className="w-48"
        />
        <SearchSelect
          value={p.sort}
          onChange={(v) => p.onSortChange(v as IssueSortKey)}
          options={(Object.keys(SORT_LABELS) as IssueSortKey[]).map((k) => ({
            value: k,
            label: SORT_LABELS[k],
          }))}
          placeholder="Sortieren"
          ariaLabel="Sortierung"
          className="w-44"
        />
        <ToggleGroup
          value={p.density}
          options={[
            { id: "comfortable", label: "Komfort" },
            { id: "compact", label: "Kompakt" },
          ]}
          onChange={p.onDensityChange}
          ariaLabel="Zeilenhöhe"
        />
      </div>
    </div>
  );
}
