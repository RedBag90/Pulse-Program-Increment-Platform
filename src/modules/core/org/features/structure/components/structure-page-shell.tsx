"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Network } from "lucide-react";
import { StructureHeader } from "@/modules/core/org/features/structure/components/structure-header";
import { StructureList } from "@/modules/core/org/features/structure/components/structure-list";
import { VsDetailPane } from "@/modules/core/org/features/structure/components/vs-detail-pane";
import { ArtDetailPane } from "@/modules/core/org/features/structure/components/art-detail-pane";
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
  canUpdateVs: boolean;
  canCreateArt: boolean;
  canUpdateArt: boolean;
  canDeleteArt: boolean;
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
 * Structure page shell — owns URL state (`?kind`, `?q`, `?selected`) and the
 * two-column master-detail layout. Routes the right pane to one of three
 * detail panes (VS / ART / Timeline) based on the selected entity.
 * Mirrors `goals-page-shell.tsx`.
 */
export function StructurePageShell({
  title,
  subtitle,
  availableKinds,
  model,
  canCreateVs,
  canUpdateVs,
  canCreateArt,
  canUpdateArt,
  canDeleteArt,
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
        <div className="rounded-lg border bg-surface-frame p-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <StructureList rows={filteredRows} selection={selection} onSelect={onSelectNode} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          {selection.kind === "vs" && model.vs.has(selection.id) ? (
            <VsDetailPane
              vs={model.vs.get(selection.id)!}
              canCreateArt={canCreateArt}
              canUpdateVs={canUpdateVs}
              onSelectArt={(id) => onSelectNode("art", id)}
            />
          ) : selection.kind === "art" && model.art.has(selection.id) ? (
            <ArtDetailPane
              art={model.art.get(selection.id)!}
              canUpdateArt={canUpdateArt}
              canDeleteArt={canDeleteArt}
              onSelectNode={onSelectNode}
            />
          ) : selection.kind === "timeline" &&
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
