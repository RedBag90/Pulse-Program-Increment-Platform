import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/domain/types";

/**
 * Legacy strategic transformation goals. Nach der Hierarchie-
 * Vereinfachung (Theme = Objective) lebt die Strategie-Definition
 * unter `/strategy`; dieses Modul liefert nur noch die Listen-
 * Read-Funktion fuer das Transformation-Cockpit + Snapshot-Service,
 * die historische Goal-Identitaeten brauchen.
 */
export async function listGoals(db: PrismaClient, tenantId: TenantId) {
  return db.transformationGoal.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    include: {
      kpis: { orderBy: { createdAt: "asc" } },
      epicLinks: {
        include: { epic: { select: { id: true, title: true, status: true } } },
      },
    },
  });
}
