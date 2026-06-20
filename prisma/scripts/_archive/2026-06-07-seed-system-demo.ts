/**
 * Backfill-Script fuer Roadmap-P4: legt fuer jedes existierende PI einen
 * leeren `SystemDemo`-Row an, damit die UI direkt drauf greifen kann
 * (Auto-Create im `addSystemDemoItem` ist ein Fallback fuer neue PIs).
 *
 * Idempotent: Skript prueft den Unique-Constraint auf `pi_id` und ueberspringt
 * PIs, die schon ein Demo haben.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-07-seed-system-demo.ts
 */

import { PrismaClient } from "@/generated/prisma";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

async function main() {
  const db = new PrismaClient();
  try {
    const pis = await db.programIncrement.findMany({
      select: { id: true, tenantId: true, name: true },
    });
    const existing = await db.systemDemo.findMany({
      select: { piId: true },
    });
    const have = new Set(existing.map((e) => e.piId));

    const missing = pis.filter((p) => !have.has(p.id));
    if (missing.length === 0) {
      console.warn("Nichts zu tun. Alle PIs haben bereits einen SystemDemo-Row.");
      return;
    }

    console.warn(`Backfill: ${missing.length} PI(s) ohne SystemDemo. Lege Rows an.`);
    await db.systemDemo.createMany({
      data: missing.map((p) => ({
        tenantId: p.tenantId,
        piId: p.id,
        createdBy: SYSTEM_ACTOR,
      })),
      skipDuplicates: true,
    });
    console.warn(`Fertig. ${missing.length} Rows geschrieben.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
