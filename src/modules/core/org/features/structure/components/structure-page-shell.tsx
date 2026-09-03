"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Network } from "lucide-react";
import { StructureHeader } from "@/modules/core/org/features/structure/components/structure-header";
import { StructureList } from "@/modules/core/org/features/structure/components/structure-list";
import {
  parseSelection,
  encodeSelection,
  type Selection,
} from "@/modules/core/org/features/structure/components/structure-selection";
import type { StructurePageModel, NodeKind } from "@/modules/core/org/server/views/structure-page";

interface Props {
  title: string;
  subtitle: string;
  /** Welche Knoten-Arten in dieser Page-Instanz angezeigt werden. Filtert
   *  die Chip-Palette + die EmptyPane-Copy. */
  availableKinds: NodeKind[];
  model: StructurePageModel;
  canCreateVs: boolean;
  canManageTimeline: boolean;
  /** Kadenz-Slots (Drumbeat). Vom Composition-Root (`/timelines`) injiziert,
   *  damit dieser Core-Org-Shell die Kadenz-Komponenten (Drumbeat) nicht direkt
   *  importiert (ADR-0013). `/structure` lässt sie weg. */
  createTimelineSlot?: ReactNode;
  renderTimelineDetail?: (timeline: TimelineNode, onSelectNode: OnSelectNode) => ReactNode;
}

type TimelineNode = NonNullable<ReturnType<StructurePageModel["timeline"]["get"]>>;
type OnSelectNode = (kind: NodeKind, id: string) => void;

const NODE_KIND_SET = new Set<NodeKind>(["vs", "art", "timeline"]);

function parseKind(raw: string | null): NodeKind | null {
  if (raw && NODE_KIND_SET.has(raw as NodeKind)) return raw as NodeKind;
  return null;
}

/**
 * Shell der **Kadenz-Fläche** (`/structure/timelines`) — URL-Zustand (`?kind`,
 * `?q`, `?selected`) und das zweispaltige Master-Detail-Layout.
 *
 * Wertströme und ARTs haben seit dem Struktur-Umbau eigene Routen; ihre Panes
 * sind entfallen. Übrig bleibt das Timeline-Detail, das der Composition-Root
 * per Render-Funktion hereinreicht.
 */
export function StructurePageShell({
  title,
  subtitle,
  availableKinds,
  model,
  canCreateVs,
  canManageTimeline,
  createTimelineSlot,
  renderTimelineDetail,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kindFilter = parseKind(searchParams.get("kind"));
  const query = searchParams.get("q") ?? "";
  const selection = parseSelection(searchParams.get("selected"));

  const pushParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onQueryChange = useCallback((next: string) => pushParam("q", next || null), [pushParam]);
  const onKindFilterChange = useCallback(
    (next: NodeKind | null) => pushParam("kind", next),
    [pushParam],
  );
  const setSelection = useCallback(
    (sel: Selection) => pushParam("selected", encodeSelection(sel)),
    [pushParam],
  );
  const onSelectNode = useCallback(
    (kind: NodeKind, id: string) => setSelection({ kind, id }),
    [setSelection],
  );

  // Filtered rows. The kind filter hides whole groups; search matches the
  // label substring (case-insensitive).
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.rows.filter((r) => {
      if (kindFilter != null && r.kind !== kindFilter) return false;
      if (q === "") return true;
      return r.label.toLowerCase().includes(q);
    });
  }, [model.rows, kindFilter, query]);

  return (
    <div className="space-y-4 p-6">
      <StructureHeader
        title={title}
        subtitle={subtitle}
        query={query}
        kindFilter={kindFilter}
        canCreateVs={canCreateVs}
        canManageTimeline={canManageTimeline}
        createTimelineSlot={createTimelineSlot}
        kindCounts={model.kindCounts}
        availableKinds={availableKinds}
        onQueryChange={onQueryChange}
        onKindFilterChange={onKindFilterChange}
      />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div
          data-tour="structure-tree"
          className="rounded-lg border bg-surface-frame p-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto"
        >
          <StructureList rows={filteredRows} selection={selection} onSelect={onSelectNode} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {selection.kind === "timeline" &&
          model.timeline.has(selection.id) &&
          renderTimelineDetail ? (
            renderTimelineDetail(model.timeline.get(selection.id)!, onSelectNode)
          ) : (
            <EmptyPane />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Network className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">Wähle einen Knoten aus der Liste.</p>
    </div>
  );
}
