/**
 * Backfill-Script für die `RoleCapability`-Tabelle.
 *
 * Was es macht: für jeden Tenant für jedes (role, action, scope)-Tupel aus
 * `POLICIES` einen `RoleCapability`-Row anlegen. Damit hat der Tenant das
 * Default-Bundle 1:1 in der DB — der Editor (PR C) kann delta-editieren,
 * der Resolver-Switch (PR B) findet sofort etwas vor.
 *
 * Idempotent: ein zweiter Lauf macht nichts neu (Unique-Constraint auf
 * `(tenantId, role, action)` + `upsert` mit update-empty-data).
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-07-seed-role-capabilities.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

async function main() {
  const db = new PrismaClient();
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
    const tuples = enumerateDefaultCapabilities();
    console.warn(`Backfill: ${tenants.length} Tenant(s) × ${tuples.length} Default-Capabilities.`);

    let written = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      for (const t of tuples) {
        const existing = await db.roleCapability.findUnique({
          where: {
            tenantId_role_action: {
              tenantId: tenant.id,
              role: t.role,
              action: t.action,
            },
          },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await db.roleCapability.create({
          data: {
            tenantId: tenant.id,
            role: t.role,
            action: t.action,
            scope: t.scope,
            createdBy: SYSTEM_ACTOR,
          },
        });
        written++;
      }
      console.warn(`  Tenant ${tenant.name}: durch.`);
    }

    console.warn(`Fertig. ${written} neu, ${skipped} schon vorhanden.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
