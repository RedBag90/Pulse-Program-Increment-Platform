"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateValueStreamDialog } from "@/modules/core/org/features/value-stream/components/create-value-stream-dialog";
import type { NodeKind } from "@/modules/core/org/server/views/structure-page";

interface Props {
  title: string;
  subtitle: string;
  query: string;
  kindFilter: NodeKind | null;
  canCreateVs: boolean;
  canManageTimeline: boolean;
  /** Kadenz-CTA (Drumbeat), vom Composition-Root injiziert; nur gerendert wenn
   *  `canManageTimeline`. */
  createTimelineSlot?: ReactNode;
  kindCounts: Record<NodeKind, number>;
  /** Welche Filter-Chips angezeigt werden. Bestimmt, fuer welche Knoten-
   *  Arten Chips sichtbar sind; reihenfolge fixiert via `KIND_ORDER`. */
  availableKinds: NodeKind[];
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
  title,
  subtitle,
  query,
  kindFilter,
  canCreateVs,
  canManageTimeline,
  createTimelineSlot,
  kindCounts,
  availableKinds,
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

  const visibleKinds = KIND_ORDER.filter((k) => availableKinds.includes(k));
  const total = visibleKinds.reduce((a, k) => a + kindCounts[k], 0);
  // Mit nur einer Knoten-Art sind die Chips redundant zur Page-Identitaet.
  const showChips = visibleKinds.length > 1;

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateVs && <CreateValueStreamDialog />}
          {canManageTimeline && createTimelineSlot}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showChips && (
          <div className="flex flex-wrap gap-1">
            <Chip
              label="Alle"
              count={total}
              active={kindFilter === null}
              onClick={() => onKindFilterChange(null)}
            />
            {visibleKinds.map((kind) => (
              <Chip
                key={kind}
                label={KIND_LABELS[kind]}
                count={kindCounts[kind]}
                active={kindFilter === kind}
                onClick={() => onKindFilterChange(kindFilter === kind ? null : kind)}
              />
            ))}
          </div>
        )}
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
