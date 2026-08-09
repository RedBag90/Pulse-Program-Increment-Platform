/**
 * Backfill-Script für die Reifegrad-Modell-v2-Migration vom 2026-06-07.
 *
 * Was es macht:
 *
 * 1. Alle Epics mit `stageGate = "L1"` ohne `hypothesisApprovedAt` werden auf
 *    `L0` zurückgesetzt. Im neuen Modell heißt L1 „Hypothese definiert" — das
 *    setzt Hypothese-Approval voraus, nicht nur Owner-Zuweisung.
 *
 * 2. Alle Epics mit `stageGate = "L5"` werden auf `L4` zurückgesetzt. Im neuen
 *    Modell ist L5 „Impact realisiert" und verlangt einen Controlling-Schritt
 *    (`confirmEpicImpact` im Folge-PR). Bestehende „Implementation done"-Epics
 *    bleiben technisch fertig, aber bis Controlling den Impact bestätigt,
 *    stehen sie auf L4.
 *
 * Pro Migrationsschritt wird ein Audit-Event geschrieben, damit der Pfad in der
 * History sichtbar bleibt.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-07-stage-gate-rework.ts
 *
 * Idempotent: ein zweiter Lauf ist no-op (die Bedingungen treffen nur einmal).
 */

import { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

const REASON = "stage_gate_model_v2_migration_2026_06_07";

async function main() {
  const db = new PrismaClient();
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
    console.warn(`Backfill über ${tenants.length} Tenant(s).`);

    let totalL1ToL0 = 0;
    let totalL5ToL4 = 0;

    for (const tenant of tenants) {
      // L1 ohne Hypothese-Stempel → L0
      const l1WithoutStamp = await db.initiative.findMany({
        where: {
          tenantId: tenant.id,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          stageGate: "L1",
          hypothesisApprovedAt: null,
        },
        select: { id: true, title: true },
      });

      // L5 → L4 (Impact muss neu bestätigt werden)
      const l5Epics = await db.initiative.findMany({
        where: {
          tenantId: tenant.id,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
          stageGate: "L5",
        },
        select: { id: true, title: true },
      });

      if (l1WithoutStamp.length === 0 && l5Epics.length === 0) {
        console.warn(`  Tenant ${tenant.name}: nichts zu tun.`);
        continue;
      }

      console.warn(
        `  Tenant ${tenant.name}: ${l1WithoutStamp.length} × L1→L0 · ${l5Epics.length} × L5→L4`,
      );

      await db.$transaction(async (tx) => {
        for (const e of l1WithoutStamp) {
          await tx.initiative.update({
            where: { id: e.id },
            data: { stageGate: "L0" },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: tenant.id,
              actorId: "00000000-0000-0000-0000-000000000000",
              action: "initiative.stage_gate.advanced",
              resourceType: "initiative",
              resourceId: e.id,
              changes: {
                stageGate: { before: "L1", after: "L0" },
                reason: REASON,
              },
            },
          });
          totalL1ToL0++;
        }
        for (const e of l5Epics) {
          await tx.initiative.update({
            where: { id: e.id },
            data: { stageGate: "L4" },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: tenant.id,
              actorId: "00000000-0000-0000-0000-000000000000",
              action: "initiative.stage_gate.advanced",
              resourceType: "initiative",
              resourceId: e.id,
              changes: {
                stageGate: { before: "L5", after: "L4" },
                reason: REASON,
              },
            },
          });
          totalL5ToL4++;
        }
      });
    }

    console.warn(`Fertig. ${totalL1ToL0} × L1→L0 · ${totalL5ToL4} × L5→L4 umgestempelt.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
