import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import { notDeleted } from "@/server/db/soft-delete";

/**
 * The full portfolio structure tree — Value Streams → ARTs → Teams — for the
 * Structure hub. Excludes soft-deleted value streams and ARTs. Read-only.
 */
export async function getStructureTree(db: PrismaClient, tenantId: TenantId) {
  return db.valueStream.findMany({
    where: { tenantId, ...notDeleted },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      financeApproverId: true,
      vmoId: true,
      arts: {
        where: { ...notDeleted },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          piCadenceWeeks: true,
          rteId: true,
          _count: { select: { pis: true } },
          teams: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              headcount: true,
              targetVelocity: true,
              teamType: true,
              scrumMasterId: true,
              productOwnerId: true,
            },
          },
        },
      },
    },
  });
}

export type StructureTree = Awaited<ReturnType<typeof getStructureTree>>;

/**
 * Timelines + subscribed ARTs + unassigned ARTs — backs the new Structure
 * Timeline tab. Each Timeline carries its PI grid (the shared cadence); ARTs
 * appear nested under the Timeline they joined; ARTs without a Timeline are
 * surfaced separately so the user can assign them.
 */
export async function getStructureTimeline(db: PrismaClient, tenantId: TenantId) {
  const [timelines, unassignedArts] = await Promise.all([
    db.timeline.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        programIncrements: {
          orderBy: { startDate: "asc" },
          select: { id: true, name: true, startDate: true, endDate: true, status: true },
        },
        arts: {
          where: { ...notDeleted, valueStream: { ...notDeleted } },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            valueStream: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.art.findMany({
      where: {
        tenantId,
        ...notDeleted,
        valueStream: { ...notDeleted },
        timelineId: null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        valueStream: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { timelines, unassignedArts };
}

export type StructureTimeline = Awaited<ReturnType<typeof getStructureTimeline>>;

/**
 * Lightweight metrics for the Structure Overview dashboard: how many Epics each
 * value stream carries, and how many Program Increments are currently active.
 */
export async function getStructureMetrics(db: PrismaClient, tenantId: TenantId) {
  const [epicGroups, activePiCount] = await Promise.all([
    db.initiative.groupBy({
      by: ["valueStreamId"],
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      _count: { _all: true },
    }),
    db.programIncrement.count({ where: { tenantId, status: "active" } }),
  ]);

  const epicsByValueStream: Record<string, number> = {};
  for (const g of epicGroups) {
    if (g.valueStreamId) epicsByValueStream[g.valueStreamId] = g._count._all;
  }
  return { epicsByValueStream, activePiCount };
}
