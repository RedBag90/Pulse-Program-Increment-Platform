import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
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
      budgetAmount: true,
      budgetCurrency: true,
      financeApproverId: true,
      vmoId: true,
      arts: {
        where: { ...notDeleted },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
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
              _count: { select: { sprints: true } },
            },
          },
        },
      },
    },
  });
}

export type StructureTree = Awaited<ReturnType<typeof getStructureTree>>;

/**
 * ARTs with their PI cadence and scheduled Program Increments — backs the
 * Structure hub's Timeline/calendar tab. Excludes soft-deleted ARTs/VS.
 */
export async function getStructureTimeline(db: PrismaClient, tenantId: TenantId) {
  return db.art.findMany({
    where: {
      tenantId,
      ...notDeleted,
      valueStream: { ...notDeleted },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      piCadenceWeeks: true,
      valueStream: { select: { id: true, name: true } },
      pis: {
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
      },
    },
  });
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
