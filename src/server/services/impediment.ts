import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, ArtId, PiId, SprintId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { publishDomainEvent } from "@/server/events/publish";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import { paginate, type PageParams } from "@/server/db/paginate";

export type ImpedimentId = string & { readonly __brand: "ImpedimentId" };
export type Severity = "low" | "medium" | "high" | "critical";
export type ImpedimentStatus = "open" | "escalated" | "resolved";

export interface CreateImpedimentInput {
  artId: ArtId;
  piId?: PiId | undefined;
  sprintId?: SprintId | undefined;
  title: string;
  description?: string | undefined;
  severity?: Severity | undefined;
}

export interface ResolveImpedimentInput {
  id: ImpedimentId;
  resolution: string;
}

export async function createImpediment(
  ctx: RequestContext,
  input: CreateImpedimentInput,
): Promise<Result<{ id: ImpedimentId }>> {
  const mctx = toMutationContext(ctx);
  const { artId, piId, sprintId, title, description, severity } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const art = await tx.art.findFirst({ where: { id: artId, tenantId: mctx.tenantId } });
    if (!art) return err({ kind: "not_found" as const, resourceType: "Art", id: artId });

    const imp = await tx.impediment.create({
      data: {
        tenantId: mctx.tenantId,
        artId,
        ...(piId !== undefined && { piId }),
        ...(sprintId !== undefined && { sprintId }),
        title,
        ...(description !== undefined && { description }),
        severity: severity ?? "medium",
        raisedBy: mctx.actorId,
      },
    });

    return ok({
      result: { id: imp.id as ImpedimentId },
      audit: { action: "impediment.raised", resourceType: "impediment", resourceId: imp.id },
    });
  });
}

export async function escalateImpediment(
  ctx: RequestContext,
  input: { id: ImpedimentId },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.impediment.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
    if (existing.status !== "open") {
      return err({ kind: "conflict" as const, reason: "Only open impediments can be escalated" });
    }

    await tx.impediment.update({ where: { id }, data: { status: "escalated" } });

    await publishDomainEvent(tx, {
      type: "impediment.escalated",
      tenantId: mctx.tenantId,
      impedimentId: id,
      artId: existing.artId as ArtId,
      title: existing.title,
      severity: existing.severity,
    });

    return ok({
      result: undefined,
      audit: {
        action: "impediment.escalated",
        resourceType: "impediment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "escalated" } },
      },
    });
  });
}

export async function resolveImpediment(
  ctx: RequestContext,
  input: ResolveImpedimentInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, resolution } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.impediment.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) return err({ kind: "not_found" as const, resourceType: "Impediment", id });
    if (existing.status === "resolved") {
      return err({ kind: "conflict" as const, reason: "Impediment is already resolved" });
    }

    await tx.impediment.update({
      where: { id },
      data: { status: "resolved", resolution, resolvedAt: new Date(), resolvedBy: mctx.actorId },
    });

    return ok({
      result: undefined,
      audit: {
        action: "impediment.resolved",
        resourceType: "impediment",
        resourceId: id,
        changes: { status: { before: existing.status, after: "resolved" } },
      },
    });
  });
}

export async function listImpediments(
  db: PrismaClient,
  tenantId: TenantId,
  artId: ArtId,
  options?: { piId?: string; status?: string },
  pageParams: PageParams = { page: 1, pageSize: 200 },
) {
  const where = {
    tenantId,
    artId,
    ...(options?.piId ? { piId: options.piId } : {}),
    ...(options?.status ? { status: options.status } : {}),
  };
  const orderBy = [{ status: "asc" as const }, { createdAt: "desc" as const }];

  return paginate(
    ({ take, skip }) => db.impediment.findMany({ where, orderBy, take, skip }),
    () => db.impediment.count({ where }),
    pageParams,
  );
}
