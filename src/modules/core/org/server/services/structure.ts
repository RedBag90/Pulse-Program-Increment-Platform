import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { notDeleted } from "@/server/db/soft-delete";

/**
 * Der Struktur-Baum: Wertstrom → ART → **Solution**. Ohne weich gelöschte
 * Zeilen, rein lesend.
 *
 * Solutions tragen immer einen Wertstrom, aber nur optional einen ART — die
 * ohne hängen im Baum direkt am Wertstrom. Sie sind hier, weil eine Solution
 * Struktur ist: ein langlebiges System, das betrieben und verändert wird.
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
      businessOwnerId: true,
      architectLeadId: true,
      arts: {
        where: { ...notDeleted },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          rteId: true,
          technicalLeadId: true,
          /**
           * **Die PIs eines ARTs hängen an seiner Kadenz, nicht an ihm.**
           * `art.pis` ist der Alt-Verweis aus der Zeit vor den Timelines
           * (siehe `ProgramIncrement.artId`); im Bestand trägt ihn **kein**
           * einziges ART. Die Baum-Zeile sagte deshalb ausnahmslos „0 PIs".
           * Mitgelesen wird beides: die Kadenz zuerst, der Alt-Verweis als
           * Rückfall, damit alte Daten nicht stumm verschwinden.
           */
          _count: { select: { pis: true } },
          timeline: { select: { _count: { select: { programIncrements: true } } } },
        },
      },
      solutions: {
        where: { ...notDeleted },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          horizon: true,
          // Nur H1 trägt einen Modus — er entscheidet, ob die Baum-Zeile
          // „Investing" oder „Extracting" sagt (`horizonLabel`).
          investmentMode: true,
          artId: true,
          productManagerId: true,
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
