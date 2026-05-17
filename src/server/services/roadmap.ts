import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, ValueStreamId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";

/**
 * Read-only roadmap queries. Each returns the raw initiative rows with the data
 * needed to derive timeframes; the timeframe maths live in `@/domain/roadmap`.
 */

/** Epics + their Features' PI windows — backs the Portfolio roadmap. */
export async function getPortfolioRoadmap(db: PrismaClient, tenantId: TenantId) {
  return db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      valueStream: { select: { name: true } },
      children: {
        where: { deletedAt: null, level: InitiativeLevel.FEATURE },
        select: { pi: { select: { startDate: true, endDate: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Features of one ART with their PI windows — backs the ART roadmap. */
export async function getArtRoadmap(db: PrismaClient, tenantId: TenantId, artId: ArtId) {
  return db.initiative.findMany({
    where: { tenantId, artId, level: InitiativeLevel.FEATURE, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      parent: { select: { id: true, title: true } },
      pi: { select: { id: true, name: true, startDate: true, endDate: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Epics of one Value Stream, each with its Features (ART + PI window). A single
 * query feeding both Value-Stream roadmap views (hierarchical / by ART).
 */
export async function getValueStreamRoadmap(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: ValueStreamId,
) {
  return db.initiative.findMany({
    where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null, valueStreamId },
    select: {
      id: true,
      title: true,
      status: true,
      children: {
        where: { deletedAt: null, level: InitiativeLevel.FEATURE },
        select: {
          id: true,
          title: true,
          status: true,
          artId: true,
          art: { select: { id: true, name: true } },
          pi: { select: { startDate: true, endDate: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
