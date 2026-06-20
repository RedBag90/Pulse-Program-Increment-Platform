/**
 * Backfill: QA-Status fuer Features wird abgeschafft. Features in den QS-
 * States `draft` und `in_review` werden auf `approved` migriert — das ist
 * der Seam in die Delivery-State-Machine (= Lane „Bereit" im neuen
 * Delivery-Cockpit). Epics sind nicht betroffen (Epics nutzen den
 * separaten `approvalPhase`-Pfad).
 *
 * Idempotent: ein zweiter Lauf trifft kein Match mehr.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-13-collapse-feature-status-qa.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/domain/types";

const REASON = "collapse_feature_status_qa_2026_06_13";
const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

async function main() {
  const db = new PrismaClient();
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
    let total = 0;
    for (const tenant of tenants) {
      const affected = await db.initiative.findMany({
        where: {
          tenantId: tenant.id,
          level: InitiativeLevel.FEATURE,
          deletedAt: null,
          status: { in: ["draft", "in_review"] },
        },
        select: { id: true, title: true, status: true },
      });

      if (affected.length === 0) {
        console.warn(`  Tenant ${tenant.name}: nichts zu tun.`);
        continue;
      }

      console.warn(`  Tenant ${tenant.name}: ${affected.length} Features migrieren.`);
      await db.$transaction(
        async (tx) => {
          // updateMany ist eine einzige SQL-Operation; per-row-Audit waeren
          // bei grossen Tenants tausende inserts in einer transaktion und
          // sprengen den Prisma-Default-Timeout. Ein Audit-Event pro Tenant
          // mit der id-Liste reicht fuer die Nachvollziehbarkeit.
          await tx.initiative.updateMany({
            where: {
              tenantId: tenant.id,
              id: { in: affected.map((f) => f.id) },
            },
            data: { status: "approved", updatedBy: SYSTEM_ACTOR },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: tenant.id,
              actorId: SYSTEM_ACTOR,
              action: "initiative.updated",
              resourceType: "initiative",
              // resourceId muss nicht-leer sein; nimm den ersten als Anker.
              resourceId: affected[0]!.id,
              changes: {
                status: { before: "draft|in_review", after: "approved" },
                reason: { before: null, after: REASON },
                featureIds: affected.map((f) => f.id),
                count: affected.length,
              },
            },
          });
        },
        { timeout: 60_000 },
      );
      total += affected.length;
    }
    console.warn(`Done. ${total} Features migriert.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
