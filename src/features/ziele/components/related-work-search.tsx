"use client";

import { useEffect, useRef, useState } from "react";

export interface RelatedWorkResult {
  id: string;
  type: "epic" | "feature" | "pi";
  name: string;
}

const TYPE_LABEL: Record<RelatedWorkResult["type"], string> = {
  epic: "Epic",
  feature: "Feature",
  pi: "PI",
};

/**
 * EIN Suchfeld für „Related work" (Asana-Stil): Volltext-Typeahead über Epics +
 * Features + PIs gegen `/api/v1/related-work?q=`. Bei Auswahl ruft der Aufrufer
 * die typrichtige Verknüpfungs-Action (`onPick`). Debounced, schließt bei
 * Outside-Click/Escape.
 */
export function RelatedWorkSearch({
  onPick,
  disabled,
}: {
  onPick: (result: RelatedWorkResult) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RelatedWorkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/v1/related-work?q=${encodeURIComponent(q)}`, {
        headers: { accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: unknown) => {
          if (!cancelled) setResults(Array.isArray(data) ? (data as RelatedWorkResult[]) : []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Epic, Feature oder PI suchen…"
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      {open && (loading || results.length > 0) && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-sm shadow-md">
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">Suche…</li>
          )}
          {results.map((r) => (
            <li key={`${r.type}:${r.id}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                  {TYPE_LABEL[r.type]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
