import { cache } from "react";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { effectivePractices, type PracticeFlags } from "@/modules/core/kernel/domain/operating-model";

/**
 * Target operating model — the management-defined "Soll". At most one `active`
 * model per tenant. Read-only helpers return the model (or null) for the gap
 * engine and the feature-gating reads across the app.
 */

/**
 * The currently active target model, or null if none has been activated yet.
 *
 * Per-Request memoisiert ueber React `cache()`: das Dashboard-Layout und mehrere
 * Page-Loader (portfolio/epics, my-tasks, implementation/features, meine-rolle,
 * epic-detail, stage-gate-engine) lesen das TOM im selben Request mehrfach —
 * hier reicht ein DB-Roundtrip pro Request.
 */
export const getActiveTargetModel = cache(async (db: PrismaClient, tenantId: TenantId) => {
  return db.targetOperatingModel.findFirst({
    where: { tenantId, status: "active" },
    orderBy: { updatedAt: "desc" },
  });
});

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
