"use client";

import { Button } from "@/components/ui/button";

interface Props {
  /** Anzahl geänderter Entitäten; 0 ⇒ Bar bleibt verborgen. */
  count: number;
  /** Aufschlüsselung, z. B. „Topf · 3 Epics · 1 ART". */
  detail: string;
  pending: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * Sticky-Save-Bar der Budget-Runde — ein Speicherpunkt für alle Ebenen. Erscheint,
 * sobald es ungespeicherte Änderungen gibt, zeigt deren Anzahl und speichert bzw.
 * verwirft sie gesammelt.
 */
export function SaveBar({ count, detail, pending, error, onSave, onDiscard }: Props) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-4 rounded-2xl border bg-card px-4 py-3 shadow-lg">
        <span
          className="size-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/15"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {count} {count === 1 ? "Änderung" : "Änderungen"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {error ? <span className="text-destructive">{error}</span> : `${detail} geändert`}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onDiscard}>
            Verwerfen
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={onSave}>
            {pending ? "Speichert…" : "Änderungen speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
