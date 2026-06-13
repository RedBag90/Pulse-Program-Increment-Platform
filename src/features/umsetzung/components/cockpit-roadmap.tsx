import {
  roadmapAxis,
  artRoadmapRows,
  type ArtRoadmapFeature,
  type RoadmapRowAccent,
} from "@/domain/roadmap";
import { RoadmapGantt } from "@/features/roadmap/components/roadmap-gantt";
import type {
  CockpitFeature,
  CockpitPiWindow,
  FeatureStatus,
} from "@/server/views/umsetzung-cockpit-view";

/**
 * Roadmap-Sicht des Cockpits — read-mostly Gantt. Mappt die Cockpit-
 * Features auf die Roadmap-Row-Form, hebt jede Row mit dem Status-Akzent
 * (Bereit · In Umsetzung · Blockiert · Fertig · Cancelled) an, und gibt
 * dem Renderer die Timeline-PIs als Boundary-Anker mit, damit man die
 * Q-Grenzen visuell sofort sieht.
 */
interface Props {
  features: CockpitFeature[];
  allPiWindows: CockpitPiWindow[];
}

function statusToAccent(status: FeatureStatus): RoadmapRowAccent {
  return status;
}

export function CockpitRoadmap({ features, allPiWindows }: Props) {
  const piById = new Map(allPiWindows.map((p) => [p.id, p]));
  const accentById = new Map(features.map((f) => [f.id, statusToAccent(f.status)]));

  const artFeatures: ArtRoadmapFeature[] = features.map((f) => {
    const pi = f.piId ? piById.get(f.piId) : null;
    return {
      id: f.id,
      title: f.title,
      parent: null,
      pi: pi ? { startDate: pi.startDate, endDate: pi.endDate } : null,
    };
  });

  const rows = artRoadmapRows(artFeatures).map((r) => ({
    ...r,
    accent: accentById.get(r.id),
  }));
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

  // PI-Boundaries als senkrechte Anker: pro PI sein startDate-Stop. Achse
  // beginnt am 1. des Monats vom fruehesten PI; der erste Boundary (gleich
  // axis.start) liegt bei 0 % und wird vom Renderer selbst aussortiert.
  const piBoundaries = allPiWindows.map((p) => ({ date: p.startDate, label: p.name }));

  return <RoadmapGantt rows={visible} axis={axis} piBoundaries={piBoundaries} />;
}
