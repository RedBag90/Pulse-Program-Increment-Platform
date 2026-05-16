import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, PiId, SprintId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";
import { sendImpedimentEscalationEmail } from "@/server/email/impediment";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImpedimentId = string & { readonly __brand: "ImpedimentId" };
export type Severity = "low" | "medium" | "high" | "critical";
export type ImpedimentStatus = "open" | "escalated" | "resolved";

export interface CreateImpedimentInput {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  piId?: PiId | undefined;
  sprintId?: SprintId | undefined;
  title: string;
  description?: string | undefined;
  severity?: Severity | undefined;
}

export interface ResolveImpedimentInput {
  tenantId: TenantId;
  actorId: UserId;
  id: ImpedimentId;
  resolution: string;
}

export async function createImpediment(
  db: PrismaClient,
  input: CreateImpedimentInput,
): Promise<Result<{ id: ImpedimentId }>> {
  const { tenantId, actorId, artId, piId, sprintId, title, description, severity } = input;

  return db
    .$transaction(async (tx) => {
      const art = await tx.art.findFirst({ where: { id: artId, tenantId } });
      if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: artId });

      const imp = await tx.impediment.create({
        data: {
          tenantId,
          artId,
          ...(piId !== undefined && { piId }),
          ...(sprintId !== undefined && { sprintId }),
          title,
          ...(description !== undefined && { description }),
          severity: severity ?? "medium",
          raisedBy: actorId,
        },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "impediment.raised",
        resourceType: "impediment",
        resourceId: imp.id,
      });

      return ok({ id: imp.id as ImpedimentId });
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function escalateImpediment(
  db: PrismaClient,
  tenantId: TenantId,
  actorId: UserId,
  id: ImpedimentId,
): Promise<Result<void>> {
  const existing = await db.impediment.findFirst({ where: { id, tenantId } });
  if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
  if (existing.status !== "open")
    return err({ kind: "conflict" as const, reason: "Only open impediments can be escalated" });

  await db.impediment.update({ where: { id }, data: { status: "escalated" } });

  await emitAuditEvent(db, {
    tenantId,
    actorId,
    action: "impediment.escalated",
    resourceType: "impediment",
    resourceId: id,
    changes: { status: { before: existing.status, after: "escalated" } },
  });

  // Fire-and-forget: look up RTE user emails and notify them
  void notifyRtesOnEscalation(
    db,
    tenantId,
    existing.artId as ArtId,
    existing.title,
    existing.severity,
  ).catch(() => undefined);

  return ok(undefined);
}

async function notifyRtesOnEscalation(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  title: string,
  severity: string,
): Promise<void> {
  // Find users with the 'rte' role in this tenant/art scope
  const assignments = await db.userRoleAssignment.findMany({
    where: {
      tenantId,
      role: "rte",
      OR: [
        { artIds: { isEmpty: true } }, // global RTE
        { artIds: { has: artId } }, // ART-scoped RTE
      ],
    },
    select: { userId: true },
  });

  if (assignments.length === 0) return;

  const art = await db.art.findFirst({ where: { id: artId }, select: { name: true } });

  // Resolve user emails via Supabase admin API
  const admin = createAdminClient();
  const emails: string[] = [];
  for (const { userId } of assignments) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.email) emails.push(data.user.email);
  }

  await sendImpedimentEscalationEmail({
    rteEmails: emails,
    impedimentTitle: title,
    severity,
    artName: art?.name ?? artId,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    artId,
  });
}

export async function resolveImpediment(
  db: PrismaClient,
  input: ResolveImpedimentInput,
): Promise<Result<void>> {
  const { tenantId, actorId, id, resolution } = input;

  return db
    .$transaction(async (tx) => {
      const existing = await tx.impediment.findFirst({ where: { id, tenantId } });
      if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
      if (existing.status === "resolved")
        return err({ kind: "conflict" as const, reason: "Impediment is already resolved" });

      await tx.impediment.update({
        where: { id },
        data: { status: "resolved", resolution, resolvedAt: new Date(), resolvedBy: actorId },
      });

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId,
        action: "impediment.resolved",
        resourceType: "impediment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "resolved" } },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      throw e;
    });
}

export async function listImpediments(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  options?: { piId?: string; status?: string },
) {
  return db.impediment.findMany({
    where: {
      tenantId,
      artId,
      ...(options?.piId ? { piId: options.piId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}
