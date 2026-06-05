"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StatusFilter = "active" | "achieved" | "archived" | "all";

interface Props {
  status: StatusFilter;
  query: string;
  canManage: boolean;
  onStatusChange: (next: StatusFilter) => void;
  onQueryChange: (next: string) => void;
  onNewGoal: () => void;
  counts: Record<StatusFilter, number>;
}

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "achieved", label: "Erreicht" },
  { value: "archived", label: "Archiviert" },
  { value: "all", label: "Alle" },
];

/**
 * Page header for the strategic-goals page: title + filter chips + search +
 * primary "+ Ziel" button. Filter chips reflect the current `?status` URL
 * param; selecting one calls `onStatusChange`, which the shell pushes to
 * the URL. The search input is debounced 200 ms so URL-driven re-renders
 * don't fight the typing.
 */
export function GoalsHeader({
  status,
  query,
  canManage,
  onStatusChange,
  onQueryChange,
  onNewGoal,
  counts,
}: Props) {
  const [draft, setDraft] = useState(query);

  // Keep local input in sync if the URL query changes externally (e.g. nav).
  useEffect(() => setDraft(query), [query]);

  // Debounce query → URL push so each keystroke doesn't navigate.
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, onQueryChange]);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Strategische Ziele</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Die vom Senior Management vorgegebene Richtung — Ziele, ihre KPIs und die Epics, die sie
            realisieren.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={onNewGoal} size="sm">
            <Plus className="size-3.5" /> Ziel
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onStatusChange(f.value)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground hover:bg-muted/50"
                }`}
                aria-pressed={active}
              >
                {f.label}
                <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
                  {counts[f.value]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Suche…"
            className="h-8 pl-7"
          />
        </div>
      </div>
    </header>
  );
}
