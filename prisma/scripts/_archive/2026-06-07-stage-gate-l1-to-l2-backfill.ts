/**
 * Backfill: Epics, die in der Phase business_case / stakeholder_review /
 * approved feststecken, aber stageGate immer noch auf L1 haben, werden auf
 * L2 nachgezogen. Der saveBusinessCase- und submitBusinessCase-Trigger
 * existiert erst seit dem Fix vom 2026-06-07 — Bestands-Epics, die ihren
 * BC vorher gespeichert/eingereicht haben, sind sonst dauerhaft auf L1.
 *
 * Idempotent: ein zweiter Lauf trifft kein Match mehr.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-07-stage-gate-l1-to-l2-backfill.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

const REASON = "stage_gate_l1_to_l2_backfill_2026_06_07";
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
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          stageGate: "L1",
          approvalPhase: { in: ["business_case", "stakeholder_review", "approved"] },
        },
        select: { id: true, title: true, approvalPhase: true },
      });

      if (affected.length === 0) {
        console.warn(`  Tenant ${tenant.name}: nichts zu tun.`);
        continue;
      }

      console.warn(`  Tenant ${tenant.name}: ${affected.length} Epic(s) L1 -> L2.`);
      await db.$transaction(async (tx) => {
        for (const e of affected) {
          await tx.initiative.update({
            where: { id: e.id },
            data: { stageGate: "L2" },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: tenant.id,
              actorId: SYSTEM_ACTOR,
              action: "initiative.stage_gate.advanced",
              resourceType: "initiative",
              resourceId: e.id,
              changes: {
                stageGate: { before: "L1", after: "L2" },
                approvalPhase: e.approvalPhase,
                reason: REASON,
              },
            },
          });
          total++;
        }
      });
    }
    console.warn(`Fertig. ${total} Epic(s) auf L2 nachgezogen.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
