"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateValueStreamDialog } from "@/features/portfolio/components/create-value-stream-dialog";
import { CreateTimelineButton } from "@/features/structure/components/create-timeline-button";
import type { NodeKind } from "@/server/views/structure-page";

interface Props {
  query: string;
  kindFilter: NodeKind | null;
  canCreateVs: boolean;
  canManageTimeline: boolean;
  kindCounts: Record<NodeKind, number>;
  onQueryChange: (next: string) => void;
  onKindFilterChange: (next: NodeKind | null) => void;
}

const KIND_LABELS: Record<NodeKind, string> = {
  vs: "Wertströme",
  art: "ARTs",
  team: "Teams",
  timeline: "Timelines",
};

const KIND_ORDER: NodeKind[] = ["vs", "art", "team", "timeline"];

/**
 * Title + primary CTAs (Wertstrom anlegen · Timeline anlegen) + node-kind
 * filter chips with live counts + 200ms-debounced search.
 */
export function StructureHeader({
  query,
  kindFilter,
  canCreateVs,
  canManageTimeline,
  kindCounts,
  onQueryChange,
  onKindFilterChange,
}: Props) {
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const t = window.setTimeout(() => onQueryChange(draft), 200);
    return () => window.clearTimeout(t);
  }, [draft, query, onQueryChange]);

  const total = Object.values(kindCounts).reduce((a, b) => a + b, 0);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Struktur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Die Organisation hinter dem Portfolio — Wertströme, ARTs, Teams, Timelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateVs && <CreateValueStreamDialog />}
          {canManageTimeline && <CreateTimelineButton />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          <Chip
            label="Alle"
            count={total}
            active={kindFilter === null}
            onClick={() => onKindFilterChange(null)}
          />
          {KIND_ORDER.map((kind) => (
            <Chip
              key={kind}
              label={KIND_LABELS[kind]}
              count={kindCounts[kind]}
              active={kindFilter === kind}
              onClick={() => onKindFilterChange(kindFilter === kind ? null : kind)}
            />
          ))}
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

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground hover:bg-muted/50"
      }`}
      aria-pressed={active}
    >
      {label}
      <span className={`tabular-nums ${active ? "opacity-80" : "text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}
