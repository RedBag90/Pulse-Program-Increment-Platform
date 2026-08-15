"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { CATEGORY_LABELS } from "@/modules/risks/features/risk/components/labels";
import type { RiskCategory } from "@/modules/risks/domain/risk-category";

export type IssueSortKey = "created:desc" | "daysOpen:desc" | "exposure:desc" | "title:asc";
export type IssueDensity = "comfortable" | "compact";

const SORT_LABELS: Record<IssueSortKey, string> = {
  "created:desc": "Neueste zuerst",
  "daysOpen:desc": "Am längsten offen",
  "exposure:desc": "Höchste Exposure",
  "title:asc": "Titel A–Z",
};

const SELECT =
  "flex h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  query: string;
  category: string | null;
  ownerId: string | null;
  sort: IssueSortKey;
  density: IssueDensity;
  categoryOptions: string[];
  ownerOptions: { id: string; label: string }[];
  onQueryChange: (v: string) => void;
  onCategoryChange: (v: string | null) => void;
  onOwnerChange: (v: string | null) => void;
  onSortChange: (v: IssueSortKey) => void;
  onDensityChange: (v: IssueDensity) => void;
}

export function IssuesFilterBar(p: Props) {
  const [draft, setDraft] = useState(p.query);
  useEffect(() => setDraft(p.query), [p.query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== p.query) p.onQueryChange(draft);
    }, 200);
    return () => clearTimeout(t);
  }, [draft]);

  const hasActiveFilter = p.category !== null || p.ownerId !== null || p.query !== "";
  const clearAll = () => {
    p.onCategoryChange(null);
    p.onOwnerChange(null);
    setDraft("");
    p.onQueryChange("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={SELECT}
        value={p.category ?? ""}
        onChange={(e) => p.onCategoryChange(e.target.value || null)}
      >
        <option value="">Alle Kategorien</option>
        {p.categoryOptions.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c as RiskCategory] ?? c}
          </option>
        ))}
      </select>

      <select
        className={SELECT}
        value={p.ownerId ?? ""}
        onChange={(e) => p.onOwnerChange(e.target.value || null)}
      >
        <option value="">Alle Owner</option>
        {p.ownerOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Suchen…"
        className="h-9 w-40"
      />

      {hasActiveFilter && (
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1 size-3.5" />
          Filter
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <select
          className={SELECT}
          value={p.sort}
          onChange={(e) => p.onSortChange(e.target.value as IssueSortKey)}
        >
          {(Object.keys(SORT_LABELS) as IssueSortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
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
