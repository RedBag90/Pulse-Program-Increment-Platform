"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  roadmapAxis,
  cockpitRoadmapRows,
  type CockpitRoadmapFeature,
  type RoadmapRowAccent,
} from "@/modules/work/domain/roadmap";
import {
  RoadmapGantt,
  type GanttDependency,
} from "@/modules/drumbeat/features/roadmap/components/roadmap-gantt";
import type {
  CockpitDependency,
  CockpitFeature,
  CockpitPiWindow,
  FeatureStatus,
} from "@/modules/drumbeat/server/views/umsetzung-cockpit-view";
import type { DependencyEdgeType } from "@/modules/drumbeat/server/views/breakdown-network-view";
import { useDependencyEdgeEditing } from "@/modules/drumbeat/features/dependencies/hooks/use-dependency-edge-editing";
import { EdgeTypeMenu } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import { FeaturePickerPopover } from "@/modules/drumbeat/features/dependencies/components/feature-picker-popover";
import { useLongPressLink } from "@/modules/drumbeat/features/dependencies/hooks/use-long-press-link";
import { LinkPreviewOverlay } from "@/modules/drumbeat/features/dependencies/components/link-preview-overlay";

/**
 * Roadmap-Sicht des Cockpits — kompakter Gantt mit Epic-Grouping,
 * Dependency-Pfeilen, Off-Scope-Markern und (neu) Editing-Affordances:
 * Klick auf eine Linie oeffnet das EdgeTypeMenu (Typ aendern / loeschen);
 * Hover ueber eine Bar zeigt einen „+" Knopf rechts, der den
 * FeaturePickerPopover oeffnet — Cross-ART-faehig per Tenant-weiter
 * Suche.
 */
interface Props {
  features: CockpitFeature[];
  allPiWindows: CockpitPiWindow[];
  dependencies: CockpitDependency[];
  /** ART-Scope fuer die Dep-Editing-Actions (Permission-Check + Source-ART). */
  artId: string;
  /** Wenn false, sind die Editing-Affordances ausgeblendet (read-only). */
  canLinkDependency: boolean;
}

function statusToAccent(status: FeatureStatus): RoadmapRowAccent {
  return status;
}

type EdgeAnchor = { depId: string; type: DependencyEdgeType; x: number; y: number };
type AddAnchor = { sourceId: string; x: number; y: number };

export function CockpitRoadmap({
  features,
  allPiWindows,
  dependencies,
  artId,
  canLinkDependency,
}: Props) {
  const t = useTranslations();
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor | null>(null);
  const [addAnchor, setAddAnchor] = useState<AddAnchor | null>(null);
  /** „Quelle/Ziel ändern…" im Pfeil-Menü: die Feature-Suche an der Stelle des Tippens. */
  const [endPick, setEndPick] = useState<{
    depId: string;
    end: "from" | "to";
    x: number;
    y: number;
  } | null>(null);
  const { error, callLink, callUnlink, callChangeType, callRelink } = useDependencyEdgeEditing(
    artId,
    dependencies,
  );

  /**
   * Touch: eine Feature-Zeile halten und auf eine andere ziehen legt eine
   * Abhängigkeit an (`blocks`); einen Pfeil halten versetzt sein näheres Ende.
   */
  const touchLink = useLongPressLink({
    enabled: canLinkDependency,
    onDrop: (drop) => {
      if (drop.kind === "create") callLink(drop.fromId, drop.toId);
      else callRelink(drop.depId, drop.newFromId, drop.newToId);
    },
  });
  const titelVon = (id: string) => features.find((f) => f.id === id)?.title ?? id;

  // Das Pfeil-Menü schliesst bei Tippen oder Klick daneben und mit Escape —
  // früher beim Verlassen mit der Maus, was es auf Touch nie tat.
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!edgeAnchor) return;
    const daneben = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setEdgeAnchor(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEdgeAnchor(null);
    };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", esc);
    };
  }, [edgeAnchor]);

  const piById = new Map(allPiWindows.map((p) => [p.id, p]));

  const cockpitFeatures: CockpitRoadmapFeature[] = features.map((f) => {
    const pi = f.piId ? piById.get(f.piId) : null;
    return {
      id: f.id,
      title: f.title,
      parentId: f.parentId,
      parentTitle: f.parentTitle,
      pi: pi ? { startDate: pi.startDate, endDate: pi.endDate } : null,
      accent: statusToAccent(f.status),
    };
  });

  const rows = cockpitRoadmapRows(cockpitFeatures).map((r) => r);
  // Backlog-only Features (kein PI) verstecken — sie wuerden die Axis
  // ausweiten und im Track leer bleiben. Epic-Header-Rows ohne Range
  // bleiben dabei drin, damit die Hierarchie nicht zerreisst.
  const visible = rows.filter((r) => r.kind === "epic" || r.kind === "group" || r.range !== null);
  const axis = roadmapAxis(visible);

  const featureWithRange = visible.find((r) => r.kind === "feature" && r.range !== null);
  if (!featureWithRange) {
    return (
      <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">
          {t("drumbeat.ui.keineTerminiertenFeaturesIm")}
        </p>
      </div>
    );
  }

  const piBoundaries = allPiWindows.map((p) => ({ date: p.startDate, label: p.name }));

  const visibleIds = new Set(visible.filter((r) => r.range !== null).map((r) => r.id));
  const ganttDeps: GanttDependency[] = dependencies
    .filter((d) => {
      if (d.offScopeRole === "from") return visibleIds.has(d.toId);
      if (d.offScopeRole === "to") return visibleIds.has(d.fromId);
      return visibleIds.has(d.fromId) && visibleIds.has(d.toId);
    })
    .map((d) => ({
      id: d.id,
      fromId: d.fromId,
      toId: d.toId,
      type: d.type,
      offScopeRole: d.offScopeRole,
      offScopeLabel: d.offScopeLabel,
    }));

  return (
    <div className="relative" ref={touchLink.ref}>
      <LinkPreviewOverlay preview={touchLink.preview} labelOf={titelVon} />
      {error && (
        <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive">
          {error}
        </div>
      )}

      <RoadmapGantt
        rows={visible}
        axis={axis}
        piBoundaries={piBoundaries}
        dependencies={ganttDeps}
        {...(canLinkDependency
          ? {
              onDependencyClick: (d, x, y) => setEdgeAnchor({ depId: d.id, type: d.type, x, y }),
              onAddDependencyFrom: (id, x, y) => setAddAnchor({ sourceId: id, x, y }),
            }
          : {})}
      />

      {edgeAnchor && (
        <div ref={menuRef} className="fixed z-50" style={{ left: edgeAnchor.x, top: edgeAnchor.y }}>
          <EdgeTypeMenu
            currentType={edgeAnchor.type}
            onChange={(t) => callChangeType(edgeAnchor.depId, t)}
            onDelete={() => callUnlink(edgeAnchor.depId)}
            onMoveEnd={(end, x, y) => setEndPick({ depId: edgeAnchor.depId, end, x, y })}
            onClose={() => setEdgeAnchor(null)}
          />
        </div>
      )}

      {endPick &&
        (() => {
          const d = dependencies.find((x) => x.id === endPick.depId);
          if (!d) return null;
          return (
            <FeaturePickerPopover
              anchorX={endPick.x}
              anchorY={endPick.y}
              excludeIds={[d.fromId, d.toId]}
              onSelect={(neu) => {
                if (endPick.end === "from") callRelink(d.id, neu, d.toId);
                else callRelink(d.id, d.fromId, neu);
                setEndPick(null);
              }}
              onCancel={() => setEndPick(null)}
            />
          );
        })()}
      {addAnchor && (
        <FeaturePickerPopover
          anchorX={addAnchor.x}
          anchorY={addAnchor.y}
          excludeIds={[addAnchor.sourceId]}
          onSelect={(targetId) => {
            callLink(addAnchor.sourceId, targetId);
            setAddAnchor(null);
          }}
          onCancel={() => setAddAnchor(null)}
        />
      )}
    </div>
  );
}
