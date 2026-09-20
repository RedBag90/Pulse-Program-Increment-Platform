"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

/**
 * Suche und „Nur offene Plätze" über der Rollenverteilung.
 *
 * Dasselbe Muster wie die Baum-Kopfzeile im selben Modul
 * (`structure-header.tsx`): ein lokaler Entwurf, 200 ms entprellt, dann nach
 * oben gemeldet. Ohne die Dämpfung schriebe jeder Tastenanschlag in die URL und
 * löste einen Server-Umlauf aus.
 *
 * Die Suche trifft Person, Rolle **und** Anliegen — „anna" beantwortet „wo
 * überall ist sie eingetragen", „budget" beantwortet „wen frage ich dazu".
 *
 * Links steht der Umschalter zwischen Karte und Tabelle — dasselbe
 * Bedienelement wie auf der Organisations-Fläche, aus demselben Modul. Zwei
 * Struktur-Flächen, die sich verschieden bedienen, wären schlimmer als eine
 * hässliche.
 */
export function RoleDirectoryFilterBar({
  view,
  onViewChange,
  query,
  onQueryChange,
  onlyUnfilled,
  onOnlyUnfilledChange,
  unfilledCount,
}: {
  view: "karte" | "tabelle";
  onViewChange: (next: "karte" | "tabelle") => void;
  query: string;
  onQueryChange: (next: string) => void;
  onlyUnfilled: boolean;
  onOnlyUnfilledChange: (next: boolean) => void;
  /** Für die Zahl am Umschalter — er sagt, wie viel er zeigen würde. */
  unfilledCount: number;
}) {
  const [draft, setDraft] = useState(query);

  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, onQueryChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2.5 shadow-card">
      <Segmented
        label="Darstellung"
        options={[
          { value: "karte" as const, label: "Karte" },
          { value: "tabelle" as const, label: "Tabelle" },
        ]}
        active={view}
        onSelect={onViewChange}
      />

      <button
        type="button"
        onClick={() => onOnlyUnfilledChange(!onlyUnfilled)}
        aria-pressed={onlyUnfilled}
        disabled={unfilledCount === 0 && !onlyUnfilled}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
          onlyUnfilled
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background text-foreground hover:bg-muted/50"
        }`}
      >
        Nur offene Plätze
        <span className={`tabular-nums ${onlyUnfilled ? "opacity-80" : "text-muted-foreground"}`}>
          {unfilledCount}
        </span>
      </button>

      {(query !== "" || onlyUnfilled) && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onQueryChange("");
            onOnlyUnfilledChange(false);
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Zurücksetzen
        </button>
      )}

      <div className="relative ml-auto w-full max-w-xs">
        <Search
          aria-hidden
          className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Suche Person · Rolle · Anliegen …"
          aria-label="Rollenverteilung durchsuchen"
          className="h-8 pl-7"
        />
      </div>
    </div>
  );
}
