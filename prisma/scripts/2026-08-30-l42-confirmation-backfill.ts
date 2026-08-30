/* eslint-disable no-console */
/**
 * Backfill für den neuen Schritt **L4.2 „Umsetzung fertig"**.
 *
 * Bisher fiel ein Epic automatisch auf L4.2, sobald alle Child-Features fertig
 * waren; jetzt ist L4.2 ein beantragter und abgenommener Schritt mit dem
 * Stempel `implementationCompletedAt`. Ohne Backfill verlören **L5-Epics** ihr
 * „actual"-Band im Benefit-Wasserfall und könnten den L5-Antrag nicht mehr
 * begründen — sie haben die Umsetzung nachweislich hinter sich.
 *
 * Deshalb: nur L5-Epics werden gestempelt (Datum = Timeline-Ist der Umsetzung
 * ?? completedAt ?? impactRecognizedAt ?? updatedAt); zusätzlich wird das
 * Timeline-Ist gesetzt, wenn es fehlt. **L4-Epics mit fertigen Features bleiben
 * bewusst unbestätigt** — genau deren Bestätigung ist ab jetzt ein bewusster
 * Akt.
 *
 * Idempotent — wiederholte Läufe finden 0 Zeilen.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-30-l42-confirmation-backfill.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { parseTimeline, withImplementationActual } from "@/modules/work/domain/timeline";

const prisma = new PrismaClient();

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const rows = await prisma.initiative.findMany({
    where: { level: 0, deletedAt: null, stageGate: "L5", implementationCompletedAt: null },
    select: {
      id: true,
      timeline: true,
      completedAt: true,
      impactRecognizedAt: true,
      updatedAt: true,
    },
  });

  let stamped = 0;
  for (const r of rows) {
    const actualIso = parseTimeline(r.timeline).actuals.implementation;
    const completedAt = actualIso
      ? new Date(`${actualIso}T00:00:00.000Z`)
      : (r.completedAt ?? r.impactRecognizedAt ?? r.updatedAt);
    await prisma.initiative.update({
      where: { id: r.id },
      data: {
        implementationCompletedAt: completedAt,
        ...(actualIso
          ? {}
          : {
              timeline: withImplementationActual(
                r.timeline,
                isoDay(completedAt),
              ) as unknown as object,
            }),
      },
    });
    stamped += 1;
  }
  console.log(`✓ ${stamped} L5-Epic(s) mit implementationCompletedAt (L4.2) nachgestempelt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
