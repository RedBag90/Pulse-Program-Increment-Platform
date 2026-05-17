import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId } from "@/domain/types";
import { InitiativeLevel } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { parseKpiMeasurements, type KpiMeasurement } from "@/domain/kpi";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";

export type KpiId = string & { readonly __brand: "KpiId" };

export interface CreateKpiInput {
  initiativeId: EpicId;
  name: string;
  unit?: string | undefined;
  baseline?: number | undefined;
  target?: number | undefined;
}

export interface UpdateKpiInput {
  id: KpiId;
  name?: string | undefined;
  unit?: string | undefined;
  baseline?: number | undefined;
  target?: number | undefined;
  measurements?: KpiMeasurement[] | undefined;
}

export async function createKpi(
  ctx: RequestContext,
  input: CreateKpiInput,
): Promise<Result<{ id: KpiId }>> {
  const mctx = toMutationContext(ctx);
  const { initiativeId, name, unit, baseline, target } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const epic = await tx.initiative.findFirst({
      where: {
        id: initiativeId,
        tenantId: mctx.tenantId,
        level: InitiativeLevel.EPIC,
        deletedAt: null,
      },
    });
    if (!epic) {
      return err({ kind: "not_found" as const, resourceType: "Epic", id: initiativeId });
    }

    const kpi = await tx.kpi.create({
      data: {
        tenantId: mctx.tenantId,
        initiativeId,
        name,
        measurements: [],
        createdBy: mctx.actorId,
        updatedBy: mctx.actorId,
        ...(unit !== undefined && { unit }),
        ...(baseline !== undefined && { baseline }),
        ...(target !== undefined && { target }),
      },
    });

    return ok({
      result: { id: kpi.id as KpiId },
      audit: { action: "kpi.created", resourceType: "kpi", resourceId: kpi.id },
    });
  });
}

export async function updateKpi(ctx: RequestContext, input: UpdateKpiInput): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, name, unit, baseline, target, measurements } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.kpi.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Kpi", id });
    }

    await tx.kpi.update({
      where: { id },
      data: {
        updatedBy: mctx.actorId,
        ...(name !== undefined && { name }),
        ...(unit !== undefined && { unit }),
        ...(baseline !== undefined && { baseline }),
        ...(target !== undefined && { target }),
        ...(measurements !== undefined && {
          measurements: measurements as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    return ok({
      result: undefined,
      audit: { action: "kpi.updated", resourceType: "kpi", resourceId: id },
    });
  });
}

export async function deleteKpi(ctx: RequestContext, input: { id: KpiId }): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.kpi.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Kpi", id });
    }

    await tx.kpi.delete({ where: { id } });

    return ok({
      result: undefined,
      audit: { action: "kpi.deleted", resourceType: "kpi", resourceId: id },
    });
  });
}

/** Appends a dated reading to a KPI's measurement series. */
export async function recordKpiMeasurement(
  ctx: RequestContext,
  input: { id: KpiId; date: string; value: number },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  const { id, date, value } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.kpi.findFirst({ where: { id, tenantId: mctx.tenantId } });
    if (!existing) {
      return err({ kind: "not_found" as const, resourceType: "Kpi", id });
    }

    const next: KpiMeasurement[] = [
      ...parseKpiMeasurements(existing.measurements),
      { date, value },
    ];

    await tx.kpi.update({
      where: { id },
      data: {
        updatedBy: mctx.actorId,
        measurements: next as unknown as Prisma.InputJsonValue,
      },
    });

    return ok({
      result: undefined,
      audit: { action: "kpi.updated", resourceType: "kpi", resourceId: id },
    });
  });
}

export async function listKpis(db: PrismaClient, tenantId: TenantId, initiativeId: EpicId) {
  return db.kpi.findMany({
    where: { tenantId, initiativeId },
    orderBy: { createdAt: "asc" },
  });
}
