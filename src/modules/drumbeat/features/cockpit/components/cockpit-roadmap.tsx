"use client";

import { useState } from "react";
import {
  roadmapAxis,
  cockpitRoadmapRows,
  type CockpitRoadmapFeature,
  type RoadmapRowAccent,
} from "@/modules/drumbeat/domain/roadmap";
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
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor | null>(null);
  const [addAnchor, setAddAnchor] = useState<AddAnchor | null>(null);
  const { error, callLink, callUnlink, callChangeType } = useDependencyEdgeEditing(
    artId,
    dependencies,
  );

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
        <p className="text-sm text-muted-foreground">Keine terminierten Features im Scope.</p>
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
    <div className="relative">
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
        <div
          className="fixed z-50"
          style={{ left: edgeAnchor.x, top: edgeAnchor.y }}
          onMouseLeave={() => setEdgeAnchor(null)}
        >
          <EdgeTypeMenu
            currentType={edgeAnchor.type}
            onChange={(t) => callChangeType(edgeAnchor.depId, t)}
            onDelete={() => callUnlink(edgeAnchor.depId)}
            onClose={() => setEdgeAnchor(null)}
          />
        </div>
      )}

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
