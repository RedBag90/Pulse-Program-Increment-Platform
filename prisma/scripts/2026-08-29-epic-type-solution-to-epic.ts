/* eslint-disable no-console */
/**
 * Backfill für den Rückbau des Epic-Typs `solution`.
 *
 * Eine Solution ist das langlebige Produkt (eigene Entität), ein Epic eine
 * zeitlich begrenzte Veränderung daran — „Solution" als **Epic-Typ** war
 * fachlich falsch klassifiziert. Alle Bestandswerte werden auf `epic`
 * normalisiert; im Capacity-Guardrail zählten beide als „business", es gibt
 * also keinen Verhaltenssprung. Wählbar bleiben nur noch Epic und Enabler.
 *
 * Idempotent — wiederholte Läufe finden 0 Zeilen.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-29-epic-type-solution-to-epic.ts
 */

import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const res = await prisma.initiative.updateMany({
    where: { epicType: "solution" },
    data: { epicType: "epic" },
  });
  console.log(`✓ ${res.count} Epic(s) von epicType "solution" auf "epic" normalisiert.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
