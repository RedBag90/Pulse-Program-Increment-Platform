"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ArtOption } from "@/server/views/admin-integrations";

interface Props {
  arts: ArtOption[];
  currentMap: Record<string, string>;
  /** Server action — takes the full updated map. Reused for Jira + ADO. */
  save: (map: Record<string, string>) => Promise<{ error?: string; success?: boolean }>;
  /** Hint above the inputs (Jira: "PROJ"; ADO: "Organization/Project"). */
  helpText: string;
  /** Per-ART input placeholder. */
  placeholder: string;
  /** Uppercase the input on change? (Jira's project keys are all-caps.) */
  uppercase?: boolean;
}

/**
 * Per-ART → external-project mapping. Replaces the two duplicated forms in
 * the old page (one for Jira, one for ADO) — they shared the same shape
 * (Record<artId, string>) but had no shared component. Now both call this
 * one form with the appropriate action + label set.
 *
 * One "Speichern"-button at the bottom commits the entire map because the
 * actions replace `projectKeyMap` / `projectMap` wholesale; per-row save
 * would require the row to know all other rows' values.
 */
export function ProjectMappingForm({
  arts,
  currentMap,
  save,
  helpText,
  placeholder,
  uppercase = false,
}: Props) {
  const [map, setMap] = useState<Record<string, string>>(currentMap);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(artId: string, value: string) {
    const next = uppercase ? value.toUpperCase() : value;
    setMap((prev) => ({ ...prev, [artId]: next }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await save(map);
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  if (arts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine ARTs vorhanden — Mappings können erst angelegt werden, wenn ein ART existiert.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{helpText}</p>
      <div className="space-y-2">
        {arts.map((art) => (
          <div key={art.id} className="flex items-center gap-3">
            <label
              htmlFor={`map-${art.id}`}
              className="w-48 truncate text-sm text-foreground/80"
              title={art.name}
            >
              {art.name}
            </label>
            <input
              id={`map-${art.id}`}
              value={map[art.id] ?? ""}
              onChange={(e) => handleChange(art.id, e.target.value)}
              placeholder={placeholder}
              maxLength={80}
              className={`w-48 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-mono shadow-xs focus:outline-none focus:ring-2 focus:ring-ring ${
                uppercase ? "uppercase" : ""
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
          {pending ? "Speichert…" : "Mappings speichern"}
        </Button>
        {saved && <span className="text-xs text-emerald-700">Gespeichert.</span>}
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
