import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";
import { effectivePractices, type PracticeFlags } from "@/domain/operating-model";

/**
 * Target operating model — the management-defined "Soll". At most one `active`
 * model per tenant. Read-only helpers return the model (or null) for the gap
 * engine and the feature-gating reads across the app.
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
