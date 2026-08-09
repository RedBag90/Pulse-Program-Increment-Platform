"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface InitiativeHit {
  id: string;
  title: string;
  level: number;
}

interface Props {
  /** Bildschirm-Koordinaten des Anchors (z. B. Cursor nach Klick). */
  anchorX: number;
  anchorY: number;
  /** Features, die der Picker NICHT anzeigen darf — z. B. die Source-Selber
   *  beim Anlegen einer neuen Dependency, plus alle Features mit denen
   *  schon eine Edge in die gewuenschte Richtung existiert. */
  excludeIds?: ReadonlyArray<string>;
  onSelect: (featureId: string, featureTitle: string) => void;
  onCancel: () => void;
  /** Optional vorbelegter Suchbegriff. */
  initialQuery?: string;
}

/**
 * Klein-Popover mit Typeahead-Suche nach Features (level=1) tenant-weit
 * — also auch Cross-ART. Wird vom Cockpit-Roadmap-Plus-Button und vom
 * Cockpit-Netzplan-„+ Cross-ART"-Knopf aufgerufen. Positioniert sich
 * absolut an den uebergebenen Anchor-Koordinaten; Click ausserhalb +
 * ESC schliessen.
 */
export function FeaturePickerPopover({
  anchorX,
  anchorY,
  excludeIds = [],
  onSelect,
  onCancel,
  initialQuery = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<InitiativeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/initiatives/search?q=${encodeURIComponent(query)}`, {
        headers: { accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((json: unknown) => {
          if (cancelled) return;
          const rows = Array.isArray(json) ? (json as InitiativeHit[]) : [];
          // Nur Features (level=1), keine Epics/Stories/Tasks. Exclude-Set
          // anwenden, damit z. B. die Source nicht in der Trefferliste
          // auftaucht.
          setHits(rows.filter((h) => h.level === 1 && !excludeSet.has(h.id)));
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, excludeSet]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onCancel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Feature waehlen"
      className="fixed z-50 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg"
      style={{ left: anchorX, top: anchorY }}
    >
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Feature suchen (Tenant-weit)…"
        className="w-full rounded border bg-background px-2 py-1 text-sm"
      />
      <div className="mt-2 max-h-64 overflow-y-auto text-sm">
        {loading && <p className="px-2 py-1 text-xs text-muted-foreground">Suche…</p>}
        {!loading && hits.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">Keine Treffer.</p>
        )}
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h.id, h.title)}
            className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-muted/50"
            title={h.title}
          >
            {h.title}
          </button>
        ))}
      </div>
    </div>
  );
}
