import { Prisma } from "@/generated/prisma";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import {
  parseOptions,
  validateCustomFieldValue,
  type CustomFieldType,
} from "@/domain/goal-custom-field";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
} from "@/server/services/mutation";
import { findOr404 } from "@/server/services/tenant-scope";

/**
 * Custom-Field-Definitionen + Werte an Ziel-Knoten (Epic 7). Def-CRUD ist
 * Tenant-Admin-Sache (Capability `goal.custom_field.manage`); Werte pflegt man
 * je Knoten über den Ziel-Drawer (`target.manage`). Muster: `pi-standard.ts`.
 */

/** Alle Feld-Definitionen des Tenants (Admin-Seite + Ziele-Loader). */
export async function listCustomFieldDefs(db: PrismaClient, tenantId: TenantId) {
  return db.goalCustomFieldDef.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true, options: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export interface CustomFieldDefInput {
  name: string;
  type: CustomFieldType;
  options?: string[] | null;
}

export async function createCustomFieldDef(
  ctx: RequestContext,
  input: CustomFieldDefInput,
): Promise<Result<{ id: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const def = await tx.goalCustomFieldDef.create({
        data: {
          tenantId: mctx.tenantId,
          name: input.name,
          type: input.type,
          options:
            input.type === "select" && input.options
              ? (input.options as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
          createdBy: mctx.actorId,
          updatedBy: mctx.actorId,
        },
      });
      return ok({
        result: { id: def.id },
        audit: {
          action: "goal.custom_field.created",
          resourceType: "goal_custom_field_def",
          resourceId: def.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint(`Ein Feld „${input.name}" existiert bereits`) },
  );
}

export async function updateCustomFieldDef(
  ctx: RequestContext,
  input: { id: string } & CustomFieldDefInput,
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(
    mctx,
    async (tx) => {
      const found = await findOr404(tx.goalCustomFieldDef, {
        id: input.id,
        tenantId: mctx.tenantId,
        resourceType: "GoalCustomFieldDef",
      });
      if (isErr(found)) return found;

      await tx.goalCustomFieldDef.update({
        where: { id: input.id },
        data: {
          name: input.name,
          type: input.type,
          options:
            input.type === "select" && input.options
              ? (input.options as unknown as Prisma.InputJsonValue)
              : Prisma.DbNull,
          updatedBy: mctx.actorId,
        },
      });
      return ok({
        result: undefined,
        audit: {
          action: "goal.custom_field.updated",
          resourceType: "goal_custom_field_def",
          resourceId: input.id,
        },
      });
    },
    { onPrismaError: onUniqueConstraint(`Ein Feld „${input.name}" existiert bereits`) },
  );
}

export async function deleteCustomFieldDef(
  ctx: RequestContext,
  input: { id: string },
): Promise<Result<void>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const found = await findOr404(tx.goalCustomFieldDef, {
      id: input.id,
      tenantId: mctx.tenantId,
      resourceType: "GoalCustomFieldDef",
    });
    if (isErr(found)) return found;

    // Cascade entfernt die zugehörigen Werte.
    await tx.goalCustomFieldDef.delete({ where: { id: input.id } });
    return ok({
      result: undefined,
      audit: {
        action: "goal.custom_field.deleted",
        resourceType: "goal_custom_field_def",
        resourceId: input.id,
      },
    });
  });
}

/**
 * Setzt (oder löscht) den Wert eines Custom Fields an einem Ziel-Knoten.
 * Leerer Wert ⇒ Value-Row entfernen. Validiert gegen den Feldtyp.
 */
export async function setGoalCustomFieldValue(
  ctx: RequestContext,
  input: { objectiveId: string; defId: string; value: string },
): Promise<Result<{ defId: string }>> {
  const mctx = toMutationContext(ctx);
  return withAuditedTransaction(mctx, async (tx) => {
    const nodeFound = await findOr404(tx.objective, {
      id: input.objectiveId,
      tenantId: mctx.tenantId,
      resourceType: "Objective",
    });
    if (isErr(nodeFound)) return nodeFound;

    const defFound = await findOr404(tx.goalCustomFieldDef, {
      id: input.defId,
      tenantId: mctx.tenantId,
      resourceType: "GoalCustomFieldDef",
    });
    if (isErr(defFound)) return defFound;
    const def = defFound.value;

    const validated = validateCustomFieldValue(
      def.type as CustomFieldType,
      input.value,
      parseOptions(def.options),
    );
    if (isErr(validated)) return validated;
    const clean = validated.value;

    if (clean === "") {
      await tx.goalCustomFieldValue.deleteMany({
        where: { tenantId: mctx.tenantId, objectiveId: input.objectiveId, defId: input.defId },
      });
    } else {
      await tx.goalCustomFieldValue.upsert({
        where: { objectiveId_defId: { objectiveId: input.objectiveId, defId: input.defId } },
        create: {
          tenantId: mctx.tenantId,
          objectiveId: input.objectiveId,
          defId: input.defId,
          value: clean,
          createdBy: mctx.actorId,
          updatedBy: mctx.actorId,
        },
        update: { value: clean, updatedBy: mctx.actorId },
      });
    }

    return ok({
      result: { defId: input.defId },
      audit: {
        action: "goal.custom_field.value.set",
        resourceType: "goal_custom_field_value",
        resourceId: input.defId,
      },
    });
  });
}
