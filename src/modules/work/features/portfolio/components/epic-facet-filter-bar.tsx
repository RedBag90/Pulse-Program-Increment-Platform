"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPicker } from "@/components/detail/user-picker";
import {
  EPIC_TYPES,
  HORIZONS,
  EPIC_TYPE_LABEL,
  HORIZON_LABEL,
} from "@/modules/work/domain/portfolio-guardrails";

export type FlagFilter = "all" | "steering" | "budgeting";

export const FACET_SELECT_CLASS =
  "h-8 rounded-md border border-input bg-card px-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  query: string;
  valueStreamId: string | null;
  ownerId: string | null;
  flag: FlagFilter;
  /** SAFe-Guardrail-Filter (Roadmap-G3). null = nicht gesetzt. */
  horizon: string | null;
  epicType: string | null;
  valueStreamOptions: { id: string; name: string }[];
  ownerOptions: { id: string; label: string }[];
  onQueryChange: (next: string) => void;
  onValueStreamChange: (next: string | null) => void;
  onOwnerChange: (next: string | null) => void;
  onFlagChange: (next: FlagFilter) => void;
  onHorizonChange: (next: string | null) => void;
  onEpicTypeChange: (next: string | null) => void;
  /**
   * Optionale ART-Facette (Werte = ART-Namen): nur gerendert, wenn `artOptions`
   * gesetzt ist — das Dashboard nutzt sie, die Epics-Liste nicht.
   */
  art?: string | null;
  artOptions?: string[];
  onArtChange?: (next: string | null) => void;
  /** Nachgelagerte Controls (z. B. Sortierung/Dichte der Liste), im selben Flex-Row. */
  children?: ReactNode;
}

/**
 * Die geteilte Epic-Facetten-Zeile — Wertstrom · Owner · Flag · Horizont · Typ
 * plus debounced Suche und Reset. Aus der Epics-Listen-Filterbar extrahiert,
 * damit das Portfolio-Dashboard exakt dieselben Facetten (und Prädikate, s.
 * `epics-list-shell`) anbietet. State/URL-Anbindung bleibt beim Aufrufer.
 */
export function EpicFacetFilterBar({
  query,
  valueStreamId,
  ownerId,
  flag,
  horizon,
  epicType,
  valueStreamOptions,
  ownerOptions,
  onQueryChange,
  onValueStreamChange,
  onOwnerChange,
  onFlagChange,
  onHorizonChange,
  onEpicTypeChange,
  art,
  artOptions,
  onArtChange,
  children,
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
    (art ?? null) != null ||
    query !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={FACET_SELECT_CLASS}
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

      {artOptions && onArtChange && (
        <select
          className={FACET_SELECT_CLASS}
          value={art ?? ""}
          onChange={(e) => onArtChange(e.target.value || null)}
          aria-label="ART"
        >
          <option value="">Alle ARTs</option>
          {artOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}

      <div className="w-44">
        <UserPicker
          value={ownerId ?? ""}
          onChange={(v) => onOwnerChange(v || null)}
          options={ownerOptions.map((o) => ({ value: o.id, label: o.label }))}
          ariaLabel="Owner"
          placeholder="Alle Owner"
          emptyLabel="Alle Owner"
        />
      </div>

      <select
        className={FACET_SELECT_CLASS}
        value={flag}
        onChange={(e) => onFlagChange(e.target.value as FlagFilter)}
        aria-label="Flag"
      >
        <option value="all">Alle Flags</option>
        <option value="steering">⚠ Steering</option>
        <option value="budgeting">💰 Budget</option>
      </select>

      <select
        className={FACET_SELECT_CLASS}
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
        className={FACET_SELECT_CLASS}
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
            onArtChange?.(null);
          }}
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <X className="size-3.5" /> Filter
        </Button>
      )}

      {children}
    </div>
  );
}
