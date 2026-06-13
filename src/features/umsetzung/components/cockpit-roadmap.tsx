import { roadmapAxis, artRoadmapRows, type ArtRoadmapFeature } from "@/domain/roadmap";
import { RoadmapGantt } from "@/features/roadmap/components/roadmap-gantt";
import type { CockpitFeature, CockpitPiWindow } from "@/server/views/umsetzung-cockpit-view";

/**
 * Roadmap-Sicht des Cockpits — read-mostly Gantt. Mappt die Cockpit-
 * Features auf die Roadmap-Row-Form, fuer die der existierende
 * `RoadmapGantt`-Renderer schon optimiert ist (selber Code wie
 * `/roadmap/art`). Drag-zum-Terminieren bleibt eine Folge-Story; im
 * Skelett fokussieren wir auf die korrekte Anzeige.
 */
interface Props {
  features: CockpitFeature[];
  allPiWindows: CockpitPiWindow[];
}

export function CockpitRoadmap({ features, allPiWindows }: Props) {
  const piById = new Map(allPiWindows.map((p) => [p.id, p]));

  const artFeatures: ArtRoadmapFeature[] = features.map((f) => {
    const pi = f.piId ? piById.get(f.piId) : null;
    return {
      id: f.id,
      title: f.title,
      parent: null,
      pi: pi ? { startDate: pi.startDate, endDate: pi.endDate } : null,
    };
  });

  const rows = artRoadmapRows(artFeatures);
  // Filter Backlog-only features (keine PI → keine Range) — sie wuerden
  // den Axis-Range ungewollt strecken und im Gantt eh leer dargestellt.
  const visible = rows.filter((r) => r.range !== null);
  const axis = roadmapAxis(visible);

  if (visible.length === 0) {
    return (
      <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Keine terminierten Features im Scope.</p>
      </div>
    );
  }

  return <RoadmapGantt rows={visible} axis={axis} />;
}
