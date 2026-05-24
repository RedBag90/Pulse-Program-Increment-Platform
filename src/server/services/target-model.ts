import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/server/services/mutation";
import {
  effectivePractices,
  type PracticeFlags,
  type StructureTargets,
  type OperatingModelTemplate,
} from "@/domain/operating-model";

/**
 * Target operating model — the management-defined "Soll". At most one `active`
 * model per tenant; saving keeps a single non-archived working row, and
 * activating archives any other active row. Read-only helpers return the model
 * (or null) for the gap engine and the configurator.
 */

/** The currently active target model, or null if none has been activated yet. */
export async function getActiveTargetModel(db: PrismaClient, tenantId: TenantId) {
  return db.targetOperatingModel.findFirst({
    where: { tenantId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
}

/** The working model the configurator edits — the active one, or the latest draft. */
export async function getWorkingTargetModel(db: PrismaClient, tenantId: TenantId) {
  return db.targetOperatingModel.findFirst({
    where: { tenantId, status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
  });
}

/** The practice flags in force for a tenant (all-on when no target is active). */
export async function getTenantPractices(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<PracticeFlags> {
  return effectivePractices(await getActiveTargetModel(db, tenantId));
}

export interface SaveTargetModelInput {
  template: OperatingModelTemplate;
  targetDate?: Date | null;
  structure: StructureTargets;
  practices: PracticeFlags;
  /** When true the model becomes `active` and any prior active model is archived. */
  activate: boolean;
}

export async function saveTargetModel(
  ctx: RequestContext,
  input: SaveTargetModelInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  const { template, targetDate, structure, practices, activate } = input;

  return withAuditedTransaction(mctx, async (tx) => {
    const existing = await tx.targetOperatingModel.findFirst({
      where: { tenantId: mctx.tenantId, status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
    });

    const data = {
      template,
      targetDate: targetDate ?? null,
      targetValueStreams: structure.targetValueStreams,
      targetArtsTotal: structure.targetArtsTotal,
      targetTeamsTotal: structure.targetTeamsTotal,
      targetPiCadenceWeeks: structure.targetPiCadenceWeeks,
      ...practices,
      status: activate ? "active" : "draft",
      updatedBy: mctx.actorId,
    };

    const model = existing
      ? await tx.targetOperatingModel.update({ where: { id: existing.id }, data })
      : await tx.targetOperatingModel.create({
          data: { ...data, tenantId: mctx.tenantId, createdBy: mctx.actorId },
        });

    if (activate) {
      // Keep a single active model — archive any other active row.
      await tx.targetOperatingModel.updateMany({
        where: { tenantId: mctx.tenantId, status: "active", id: { not: model.id } },
        data: { status: "archived" },
      });
    }

    return ok({
      result: { id: model.id },
      audit: {
        action: activate ? "target.activated" : existing ? "target.updated" : "target.created",
        resourceType: "target_operating_model",
        resourceId: model.id,
      },
    });
  });
}
