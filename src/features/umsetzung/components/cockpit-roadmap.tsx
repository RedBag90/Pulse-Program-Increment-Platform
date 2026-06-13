import {
  roadmapAxis,
  cockpitRoadmapRows,
  type CockpitRoadmapFeature,
  type RoadmapRowAccent,
} from "@/domain/roadmap";
import { RoadmapGantt, type GanttDependency } from "@/features/roadmap/components/roadmap-gantt";
import type {
  CockpitDependency,
  CockpitFeature,
  CockpitPiWindow,
  FeatureStatus,
} from "@/server/views/umsetzung-cockpit-view";

/**
 * Roadmap-Sicht des Cockpits — read-mostly, **compact** Gantt mit
 * Epic-Grouping. Features stehen indented unter ihrem Parent-Epic
 * (Linear/Productboard-Pattern), der Epic-Header zeigt das aus den
 * Feature-PIs abgeleitete Soll-Fenster. Status-Akzent pro Feature-Bar,
 * PI-Grid + Today-Linie vom Renderer. Dependencies erscheinen als
 * Elbow-Pfeile ueber dem Track (Hover-Highlight); Off-Scope-Endpunkte
 * werden als Marker am Bar-Rand gerendert.
 */
interface Props {
  features: CockpitFeature[];
  allPiWindows: CockpitPiWindow[];
  dependencies: CockpitDependency[];
}

function statusToAccent(status: FeatureStatus): RoadmapRowAccent {
  return status;
}

export function CockpitRoadmap({ features, allPiWindows, dependencies }: Props) {
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

  const rows = cockpitRoadmapRows(cockpitFeatures);
  // Backlog-only Features (kein PI) verstecken — sie wuerden die Axis
  // ausweiten und im Track leer bleiben. Epic-Header-Rows ohne Range
  // bleiben dabei drin, damit die Hierarchie nicht zerreisst.
  const visible = rows.filter((r) => r.kind === "epic" || r.kind === "group" || r.range !== null);
  // Axis wird aus den tatsaechlich gerenderten Ranges abgeleitet — Epic-
  // Header ohne eigene Range fliessen ein wenn ihre Childs ranges haben.
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

  // Dependencies in das Gantt-Format mappen. Edges deren Endpunkt im
  // Backlog liegt (sichtbare Feature aber ohne Range) werden gefiltert —
  // der RoadmapGantt rendert nur Pfade fuer Rows mit Bar. Off-Scope-
  // Edges (Endpunkt komplett ausserhalb des Scopes) gehen mit durch
  // und werden als Bar-Rand-Marker dargestellt.
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
    <RoadmapGantt rows={visible} axis={axis} piBoundaries={piBoundaries} dependencies={ganttDeps} />
  );
}
