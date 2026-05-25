import type { Prisma } from "@/generated/prisma";
import type { PlanningFeature } from "@/features/pi/components/feature-planning-board";
import type { TablePi } from "@/features/pi/components/feature-planning-table";

/**
 * PI-planning page-model — reshapes the loaded ART PIs + Features into the
 * render-ready props the board and table consume (flattening the sprint count,
 * converting the WSJF `Decimal`, picking the epic title). Pure, so the page is
 * load → build → render and the reshaping is tested here rather than in the
 * server component.
 */

/** A loaded PI row (from `listArtPlanningPis`) — structural. */
export interface PlanningPiRow {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  _count: { sprints: number };
}

/** A loaded Feature row (from `listFeatures`) — structural. */
export interface PlanningFeatureRow {
  id: string;
  title: string;
  status: string;
  wsjfComputed: Prisma.Decimal | number | null;
  parent: { title: string } | null;
  piId: string | null;
}

export interface PlanningModel {
  pis: TablePi[];
  features: PlanningFeature[];
}

export function buildPlanningModel(
  pis: readonly PlanningPiRow[],
  features: readonly PlanningFeatureRow[],
): PlanningModel {
  return {
    pis: pis.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      sprintCount: p._count.sprints,
    })),
    features: features.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      wsjf: Number(f.wsjfComputed ?? 0),
      epicTitle: f.parent?.title ?? null,
      piId: f.piId,
    })),
  };
}
