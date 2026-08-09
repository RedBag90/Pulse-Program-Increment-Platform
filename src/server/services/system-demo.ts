/**
 * System-Demo-Service (Roadmap-P4.A).
 *
 * Pro PI gibt es genau einen `SystemDemo` (Unique-Constraint am Schema).
 * Items leben in einer geordneten Liste; das Demo selbst traegt
 * `scheduledAt`, `recordingUrl` und `notes`.
 *
 * Capability fuer Mutationen: `pi.demo.manage` (RTE + FEATURE_OWNER).
 * Lesen ist tenant-scope ueber RLS.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, PiId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, err, isErr } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { findOr404 } from "@/server/services/tenant-scope";

export type SystemDemoId = string & { readonly __brand: "SystemDemoId" };
export type SystemDemoItemId = string & { readonly __brand: "SystemDemoItemId" };

export interface SystemDemoUpdate {
  piId: PiId;
  scheduledAt?: Date | null;
  recordingUrl?: string | null;
  notes?: string | null;
}

export interface AddSystemDemoItemInput {
  piId: PiId;
  title: string;
  featureId?: string;
  ownerId?: string;
}

export interface UpdateSystemDemoItemInput {
  id: SystemDemoItemId;
  title?: string;
  ownerId?: string | null;
  presented?: boolean;
}

export interface ReorderSystemDemoItemsInput {
  piId: PiId;
  orderedItemIds: SystemDemoItemId[];
}

/** Liest das SystemDemo eines PIs inkl. Items (in position-Sortierung). */
export async function getSystemDemoForPi(db: PrismaClient, tenantId: TenantId, piId: PiId) {
  return db.systemDemo.findFirst({
    where: { tenantId, piId },
    include: {
      items: { orderBy: { position: "asc" } },
    },
  });
}

/** Setzt scheduledAt, recordingUrl oder notes am SystemDemo des PIs. */
export async function updateSystemDemo(
  ctx: RequestContext,
  input: SystemDemoUpdate,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { piId, scheduledAt, recordingUrl, notes } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const demo = await tx.systemDemo.findFirst({
      where: { tenantId: mctx.tenantId, piId },
      select: { id: true },
    });
    if (!demo) {
      return err({ kind: "not_found" as const, resourceType: "SystemDemo", id: piId });
    }

    await tx.systemDemo.update({
      where: { id: demo.id },
      data: {
        ...(scheduledAt !== undefined && { scheduledAt }),
        ...(recordingUrl !== undefined && { recordingUrl }),
        ...(notes !== undefined && { notes }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "system_demo.updated",
        resourceType: "system_demo",
        resourceId: demo.id,
      },
    });
  });
}

/**
 * Fuegt ein Demo-Item ans Ende der Liste an. Auto-create des Demo-Rows,
 * falls noch keiner existiert (kompakter Eintritt aus der UI).
 */
export async function addSystemDemoItem(
  ctx: RequestContext,
  input: AddSystemDemoItemInput,
): Promise<Result<{ id: SystemDemoItemId }>> {
  const mctx = toMutationContext(ctx);
  const { piId, title, featureId, ownerId } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const pi = await findOr404(tx.programIncrement, {
      id: piId,
      tenantId: mctx.tenantId,
      resourceType: "ProgramIncrement",
    });
    if (isErr(pi)) return pi;

    // Auto-create des Demo-Rows wenn nicht vorhanden.
    const demo =
      (await tx.systemDemo.findFirst({
        where: { tenantId: mctx.tenantId, piId },
        select: { id: true },
      })) ??
      (await tx.systemDemo.create({
        data: { tenantId: mctx.tenantId, piId, createdBy: mctx.actorId },
        select: { id: true },
      }));

    const last = await tx.systemDemoItem.findFirst({
      where: { demoId: demo.id, tenantId: mctx.tenantId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = last ? last.position + 1 : 0;

    const item = await tx.systemDemoItem.create({
      data: {
        tenantId: mctx.tenantId,
        demoId: demo.id,
        title,
        position: nextPosition,
        ...(featureId !== undefined && { featureId }),
        ...(ownerId !== undefined && { ownerId }),
        createdBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: item.id as SystemDemoItemId },
      audit: {
        action: "system_demo_item.added",
        resourceType: "system_demo_item",
        resourceId: item.id,
      },
    });
  });
}

/** Aendert Title/Owner/Presented-Flag eines Items. */
export async function updateSystemDemoItem(
  ctx: RequestContext,
  input: UpdateSystemDemoItemInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, title, ownerId, presented } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const found = await tx.systemDemoItem.findFirst({
      where: { id, tenantId: mctx.tenantId },
      select: { id: true, presented: true },
    });
    if (!found) {
      return err({ kind: "not_found" as const, resourceType: "SystemDemoItem", id });
    }

    await tx.systemDemoItem.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(ownerId !== undefined && { ownerId }),
        ...(presented !== undefined && { presented }),
      },
    });
    return ok({
      result: undefined,
      audit: {
        action: "system_demo_item.updated",
        resourceType: "system_demo_item",
        resourceId: id,
        ...(presented !== undefined && {
          changes: { presented: { before: found.presented, after: presented } },
        }),
      },
    });
  });
}

/** Entfernt ein Item. Position-Lücken werden NICHT geschlossen (Reorder
 *  passiert beim naechsten reorderSystemDemoItems-Call). */
export async function deleteSystemDemoItem(
  ctx: RequestContext,
  input: { id: SystemDemoItemId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const found = await tx.systemDemoItem.findFirst({
      where: { id, tenantId: mctx.tenantId },
      select: { id: true },
    });
    if (!found) {
      return err({ kind: "not_found" as const, resourceType: "SystemDemoItem", id });
    }
    await tx.systemDemoItem.delete({ where: { id } });
    return ok({
      result: undefined,
      audit: {
        action: "system_demo_item.deleted",
        resourceType: "system_demo_item",
        resourceId: id,
      },
    });
  });
}

/**
 * Setzt die Position aller Items eines PIs in einem Schritt. Die Reihenfolge
 * in `orderedItemIds` definiert das neue Layout (Index = Position).
 * Validiert, dass jede uebergebene Id genau einmal vorkommt und alle Items
 * des Demos abdeckt.
 */
export async function reorderSystemDemoItems(
  ctx: RequestContext,
  input: ReorderSystemDemoItemsInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { piId, orderedItemIds } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const demo = await tx.systemDemo.findFirst({
      where: { tenantId: mctx.tenantId, piId },
      select: { id: true },
    });
    if (!demo) {
      return err({ kind: "not_found" as const, resourceType: "SystemDemo", id: piId });
    }

    const existing = await tx.systemDemoItem.findMany({
      where: { demoId: demo.id, tenantId: mctx.tenantId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const incomingIds = new Set(orderedItemIds);

    if (existingIds.size !== incomingIds.size) {
      return err({
        kind: "conflict" as const,
        reason: `Reorder muss alle ${existingIds.size} Items abdecken, bekam ${incomingIds.size}`,
      });
    }
    for (const id of orderedItemIds) {
      if (!existingIds.has(id)) {
        return err({
          kind: "conflict" as const,
          reason: `Item ${id} gehoert nicht zu diesem Demo`,
        });
      }
    }

    // Sequentielle Updates — die Liste ist klein (Demo-Agenda ist
    // typischerweise < 20 Items), die Audit-Trail-Sammlung an einem
    // einzigen Event reicht. Atomare Bulk-Reorders muessten in einem
    // ein-Statement-SQL gemacht werden; das skaliert spaeter, wenn noetig.
    for (let i = 0; i < orderedItemIds.length; i++) {
      await tx.systemDemoItem.update({
        where: { id: orderedItemIds[i]! },
        data: { position: i },
      });
    }

    return ok({
      result: undefined,
      audit: {
        action: "system_demo.reordered",
        resourceType: "system_demo",
        resourceId: demo.id,
      },
    });
  });
}
