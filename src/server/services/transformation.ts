import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { getStructureTree } from "@/server/services/structure";
import { getActiveTargetModel } from "@/server/services/target-model";

/**
 * The transformation gap engine — measures the current organisation (Ist)
 * against the management-defined target operating model (Soll). Phase 0 covers
 * the structure dimensions; practice-adoption and outcome gaps follow in Phase 1.
 */

export interface GapDimension {
  key: string;
  label: string;
  ist: number;
  /** Target value; `null` means this dimension is not part of the target. */
  soll: number | null;
  /** 0..1 — capped at 1; 1 when there is no target for the dimension. */
  progress: number;
}

export interface StructureGap {
  hasTarget: boolean;
  targetDate: Date | null;
  dimensions: GapDimension[];
  /** Average progress over the dimensions that carry a target. */
  overallProgress: number;
}

function dimension(key: string, label: string, ist: number, soll: number | null): GapDimension {
  const progress = soll == null || soll === 0 ? 1 : Math.min(1, ist / soll);
  return { key, label, ist, soll, progress };
}

/** Compares structure counts (Wertströme / ARTs / Teams) against the Soll. */
export async function computeStructureGap(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<StructureGap> {
  const model = await getActiveTargetModel(db, tenantId);
  if (!model) {
    return { hasTarget: false, targetDate: null, dimensions: [], overallProgress: 0 };
  }

  const tree = await getStructureTree(db, tenantId);
  const arts = tree.flatMap((vs) => vs.arts);
  const teams = arts.flatMap((a) => a.teams);

  const dimensions = [
    dimension("valueStreams", "Wertströme", tree.length, model.targetValueStreams),
    dimension("arts", "ARTs", arts.length, model.targetArtsTotal),
    dimension("teams", "Teams", teams.length, model.targetTeamsTotal),
  ];

  const withTarget = dimensions.filter((d) => d.soll != null);
  const overallProgress = withTarget.length
    ? withTarget.reduce((sum, d) => sum + d.progress, 0) / withTarget.length
    : 1;

  return { hasTarget: true, targetDate: model.targetDate, dimensions, overallProgress };
}
