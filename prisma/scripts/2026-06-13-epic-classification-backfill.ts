/**
 * Backfill-Script fuer SAFe Portfolio Guardrails (Roadmap-G1).
 *
 * Setzt sensible Defaults fuer die drei neuen Klassifikations-Felder am
 * Initiative-Model und fuer das `guardrailTargets`-JSON am Tenant:
 *
 *   - Alle EPICs ohne epicType → "epic"
 *   - Alle FEATUREs ohne featureType → "feature"
 *   - investmentHorizon bleibt null (User klassifiziert nach und nach,
 *     keine sinnvolle Heuristik beim Backfill)
 *   - Tenants ohne guardrailTargets → DEFAULT_GUARDRAIL_TARGETS
 *
 * Idempotent: zweite Laeufe machen nichts neu (prueft auf NULL).
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-06-13-epic-classification-backfill.ts
 */

import { PrismaClient } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { InitiativeLevel } from "@/domain/types";
import { DEFAULT_GUARDRAIL_TARGETS } from "@/domain/portfolio-guardrails";

async function main() {
  const db = new PrismaClient();
  try {
    // 1. Tenants ohne Targets → Defaults. JSON-NULL braucht Prisma.DbNull
    //    statt JS-null (Prisma-Filter-Quirk).
    const allTenants = await db.tenant.findMany({
      select: { id: true, name: true, guardrailTargets: true },
    });
    const tenantsToUpdate = allTenants.filter((t) => t.guardrailTargets == null);
    if (tenantsToUpdate.length > 0) {
      console.warn(`Tenants ohne guardrailTargets: ${tenantsToUpdate.length}. Setze Defaults.`);
      for (const t of tenantsToUpdate) {
        await db.tenant.update({
          where: { id: t.id },
          data: {
            guardrailTargets: DEFAULT_GUARDRAIL_TARGETS as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } else {
      console.warn("Alle Tenants haben bereits guardrailTargets gesetzt.");
    }

    // 2. EPICs ohne epicType → "epic".
    const epicRes = await db.initiative.updateMany({
      where: {
        level: InitiativeLevel.EPIC,
        deletedAt: null,
        epicType: null,
      },
      data: { epicType: "epic" },
    });
    console.warn(`EPICs ohne epicType auf "epic" gesetzt: ${epicRes.count}.`);

    // 3. FEATUREs ohne featureType → "feature".
    const featureRes = await db.initiative.updateMany({
      where: {
        level: InitiativeLevel.FEATURE,
        deletedAt: null,
        featureType: null,
      },
      data: { featureType: "feature" },
    });
    console.warn(`FEATUREs ohne featureType auf "feature" gesetzt: ${featureRes.count}.`);

    console.warn(
      "Fertig. investmentHorizon bleibt bewusst null — User klassifiziert nach und nach.",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
