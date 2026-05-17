"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InitiativeHit {
  id: string;
  title: string;
  level: number;
}

const LEVEL_LABELS = ["Epic", "Feature", "Story", "Task"];

interface InitiativeSearchFieldProps {
  /** Hidden form field name carrying the selected initiative id. */
  name: string;
  label: string;
  /** Selected initiative id. */
  value: string;
  onChange: (id: string) => void;
}

/**
 * Typeahead picker for an initiative — debounced search against
 * `GET /api/v1/initiatives/search`. Used by the global dependency dialog,
 * which must pick two initiatives with no page context.
 */
export function InitiativeSearchField({
  name,
  label,
  value,
  onChange,
}: InitiativeSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<InitiativeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/initiatives/search?q=${encodeURIComponent(query)}`, {
        headers: { accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((json: unknown) => {
          if (!cancelled) setHits(Array.isArray(json) ? (json as InitiativeHit[]) : []);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open]);

  return (
    <div className="space-y-1.5">
      <Label>
        {label} <span className="text-destructive">*</span>
      </Label>
      <input type="hidden" name={name} value={value} />

      {value ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
          <span className="truncate">{selectedTitle}</span>
          <button
            type="button"
            className="ml-2 shrink-0 text-xs text-muted-foreground hover:underline"
            onClick={() => {
              onChange("");
              setSelectedTitle("");
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search initiatives…"
          />
          {open && (
            <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md">
              {loading && <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>}
              {!loading && hits.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
              )}
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(hit.id);
                      setSelectedTitle(hit.title);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                      {LEVEL_LABELS[hit.level] ?? `L${hit.level}`}
                    </span>
                    <span className="truncate">{hit.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
