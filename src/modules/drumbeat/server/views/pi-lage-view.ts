import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId } from "@/modules/core/kernel/domain/types";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import {
  attentionOf,
  burnup,
  foldScopeDrift,
  lageHead,
  type AttentionItem,
  type Burnup,
  type LageFeature,
  type LageHead,
  type PiMoveEvent,
  type ScopeDrift,
} from "@/modules/drumbeat/domain/pi-lage";

/**
 * **PI-Lage lesen** — alles, was die Sicht „Lage" über einen ART in einem PI
 * braucht. Unabhängig von den Filtern der Toolbar: die Lage eines PIs ist
 * dieselbe, egal wonach gerade gesucht wird. (Das Board darunter folgt den
 * Filtern — es kommt aus dem Cockpit-Modell.)
 */

export interface LageRisk {
  id: string;
  title: string;
  roamStatus: string;
  probability: string | null;
  impact: string | null;
  targetResolutionDate: Date | null;
  overdue: boolean;
  ownerId: string | null;
  featureTitle: string | null;
}

export interface PiLage {
  pi: { id: string; name: string; status: string; startDate: Date; endDate: Date };
  head: LageHead;
  burnup: Burnup;
  attention: AttentionItem[];
  drift: ScopeDrift;
  risks: LageRisk[];
  value: { plannedBv: number; deliveredBv: number };
  systemDemoAt: Date | null;
  nextPi: { name: string; featureCount: number } | null;
  userLabels: Record<string, string>;
}

/** Offene ROAM-Zustände: alles ausser „resolved". */
const OFFEN_ROAM = { not: "resolved" };

export async function loadPiLage(
  db: PrismaClient,
  tenantId: TenantId,
  input: { piId: string; artId: string },
  now: Date = new Date(),
): Promise<PiLage | null> {
  const pi = await db.programIncrement.findFirst({
    where: { id: input.piId, tenantId },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      timelineId: true,
      systemDemoAt: true,
    },
  });
  if (!pi) return null;

  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      level: InitiativeLevel.FEATURE,
      deletedAt: null,
      artId: input.artId,
      piId: pi.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      wsjfJobSize: true,
      wsjfBusinessValue: true,
      completedAt: true,
      updatedAt: true,
      ownerId: true,
    },
  });
  const ids = rows.map((r) => r.id);
  const blockedIds = rows.filter((r) => r.status === "blocked").map((r) => r.id);

  const [blockAudits, moveAudits, createAudits, issues, nextPi, userLabels] = await Promise.all([
    blockedIds.length === 0
      ? Promise.resolve([])
      : db.auditEvent.findMany({
          where: {
            tenantId,
            resourceType: "initiative",
            resourceId: { in: blockedIds },
            action: "feature.delivery.transitioned",
            changes: { path: ["status", "after"], equals: "blocked" },
          },
          orderBy: { occurredAt: "desc" },
          select: { resourceId: true, occurredAt: true, changes: true },
        }),
    db.auditEvent.findMany({
      where: {
        tenantId,
        action: "initiative.updated",
        occurredAt: { gte: pi.startDate },
        OR: [
          { changes: { path: ["piId", "after"], equals: pi.id } },
          { changes: { path: ["piId", "before"], equals: pi.id } },
        ],
      },
      select: { resourceId: true, occurredAt: true, actorId: true, changes: true },
    }),
    ids.length === 0
      ? Promise.resolve([])
      : db.auditEvent.findMany({
          where: {
            tenantId,
            resourceType: "initiative",
            resourceId: { in: ids },
            action: "initiative.created",
            occurredAt: { gt: pi.startDate },
          },
          select: { resourceId: true, occurredAt: true, actorId: true },
        }),
    db.issue.findMany({
      where: {
        tenantId,
        deletedAt: null,
        roamStatus: OFFEN_ROAM,
        OR: [{ piId: pi.id }, ...(ids.length ? [{ initiativeId: { in: ids } }] : [])],
      },
      select: {
        id: true,
        title: true,
        roamStatus: true,
        probability: true,
        impact: true,
        targetResolutionDate: true,
        ownerId: true,
        initiativeId: true,
      },
    }),
    pi.timelineId
      ? db.programIncrement.findFirst({
          where: { tenantId, timelineId: pi.timelineId, startDate: { gt: pi.startDate } },
          orderBy: { startDate: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    listTenantUserLabels(db, tenantId),
  ]);

  // Blockiert seit / Grund: der jüngste Wechsel nach „blockiert".
  const blockedBy = new Map<string, { at: Date; reason: string | null }>();
  for (const a of blockAudits) {
    if (blockedBy.has(a.resourceId)) continue;
    const reason = (a.changes as { reason?: { after?: unknown } } | null)?.reason?.after;
    blockedBy.set(a.resourceId, {
      at: a.occurredAt,
      reason: typeof reason === "string" ? reason : null,
    });
  }
  const features: LageFeature[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    jobSize: r.wsjfJobSize,
    businessValue: r.wsjfBusinessValue,
    completedAt: r.completedAt,
    updatedAt: r.updatedAt,
    ownerName: r.ownerId ? (userLabels[r.ownerId] ?? null) : null,
    blockedSince: blockedBy.get(r.id)?.at ?? null,
    blockedReason: blockedBy.get(r.id)?.reason ?? null,
  }));

  // Verschiebungen: nur Features dieses ARTs, auch die hinausgeschobenen.
  const movedIds = [...new Set(moveAudits.map((m) => m.resourceId))];
  const moved = movedIds.length
    ? await db.initiative.findMany({
        where: {
          id: { in: movedIds },
          tenantId,
          artId: input.artId,
          level: InitiativeLevel.FEATURE,
        },
        select: { id: true, title: true, wsjfJobSize: true, status: true },
      })
    : [];
  const info = new Map(
    [...moved, ...rows].map((f) => [
      f.id,
      { title: f.title, jobSize: f.wsjfJobSize, status: f.status },
    ]),
  );
  const moves: PiMoveEvent[] = moveAudits
    .filter((m) => info.has(m.resourceId))
    .map((m) => ({
      featureId: m.resourceId,
      at: m.occurredAt,
      direction:
        (m.changes as { piId?: { after?: unknown } } | null)?.piId?.after === pi.id ? "in" : "out",
      actorId: m.actorId,
    }));

  const piWindow = { startDate: pi.startDate, endDate: pi.endDate, status: pi.status };
  const created = new Map(
    createAudits.map((c) => [c.resourceId, { at: c.occurredAt, actorId: c.actorId }]),
  );
  const drift = foldScopeDrift({ pi: piWindow, featuresNow: features, moves, created, info });
  const titleOf = new Map(rows.map((r) => [r.id, r.title]));
  const heute = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const risks: LageRisk[] = issues
    .map((i) => ({
      id: i.id,
      title: i.title,
      roamStatus: i.roamStatus,
      probability: i.probability,
      impact: i.impact,
      targetResolutionDate: i.targetResolutionDate,
      overdue: i.targetResolutionDate != null && i.targetResolutionDate.getTime() < heute,
      ownerId: i.ownerId,
      featureTitle: i.initiativeId ? (titleOf.get(i.initiativeId) ?? null) : null,
    }))
    .sort(
      (a, b) =>
        Number(b.roamStatus === "open") - Number(a.roamStatus === "open") ||
        Number(b.overdue) - Number(a.overdue) ||
        (a.targetResolutionDate?.getTime() ?? Infinity) -
          (b.targetResolutionDate?.getTime() ?? Infinity),
    );

  const nextCount = nextPi
    ? await db.initiative.count({
        where: {
          tenantId,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
          artId: input.artId,
          piId: nextPi.id,
        },
      })
    : 0;

  const plan = features.filter((f) => f.status !== "cancelled");
  return {
    pi: {
      id: pi.id,
      name: pi.name,
      status: pi.status,
      startDate: pi.startDate,
      endDate: pi.endDate,
    },
    head: lageHead(features, piWindow, now),
    burnup: burnup(features, drift, piWindow, now),
    attention: attentionOf(features, piWindow, now),
    drift,
    risks,
    value: {
      plannedBv: plan.reduce((s, f) => s + (f.businessValue ?? 0), 0),
      deliveredBv: plan
        .filter((f) => f.status === "completed")
        .reduce((s, f) => s + (f.businessValue ?? 0), 0),
    },
    systemDemoAt: pi.systemDemoAt,
    nextPi: nextPi ? { name: nextPi.name, featureCount: nextCount } : null,
    userLabels,
  };
}
