/* eslint-disable no-console */
/**
 * Backfill der **Aufteilung** — von den alten Einzel-Kandidaten in `RtbItemAward`.
 *
 * Bis zu diesem Umbau stand jede Run-the-Business-Position einzeln auf dem
 * PB-Liste, und der ART-Epic-Budget eines ARTs war der finale Betrag seiner
 * eigenen Kandidatenzeile. Seit der PB-Liste je Wertstrom **eine** Zeile trägt,
 * gibt es diese Einzelbeträge nicht mehr — der Rahmen kommt aus `RtbItemAward`.
 *
 * Ohne dieses Skript stünde jeder Topf eines bestehenden Mandanten auf 0 €, und
 * die ART-Verteilfläche wiese jede Zuteilung mit „Die Summe überschreitet den
 * Rahmen" ab. Es überträgt deshalb die **schon entschiedenen** Beträge
 * unverändert: was die Runde damals je Position festgeschrieben hat, wird zur
 * Aufteilung desselben Halbjahres.
 *
 * Idempotent: eine bereits vorhandene Aufteilung wird **nicht** überschrieben —
 * eine von Hand gesetzte Aufteilung ist die jüngere Entscheidung.
 *
 * Lauf: `pnpm tsx prisma/scripts/2026-09-04-rtb-award-backfill.ts`
 */

import { prisma } from "../seed-helpers.js";

async function main() {
  console.log("\n🔁  Backfill: Kandidaten-Endbeträge → RtbItemAward\n");

  // Nur Zeilen, die je Position entschieden wurden — die neuen Sammelzeilen
  // tragen keinen `rtbItemId` und fallen hier von selbst heraus.
  const candidates = await prisma.budgetCandidate.findMany({
    where: { kind: "rtb", rtbItemId: { not: null }, finalAmount: { not: null } },
    select: {
      tenantId: true,
      rtbItemId: true,
      finalAmount: true,
      round: { select: { cycleKey: true } },
    },
  });
  console.log(`  ${candidates.length} entschiedene Einzel-Kandidaten gefunden`);

  let written = 0;
  let skipped = 0;
  for (const c of candidates) {
    const rtbItemId = c.rtbItemId!;
    const cycleKey = c.round.cycleKey;
    const existing = await prisma.rtbItemAward.findFirst({
      where: { rtbItemId, cycleKey },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    // `createdBy`/`updatedBy` sind Pflicht und tragen hier keine Person: die
    // Zahl stammt aus der Runde, nicht aus einer Aufteilung. Der Nullspieler
    // macht das im Audit sichtbar, statt jemanden zu behaupten.
    await prisma.rtbItemAward.create({
      data: {
        tenantId: c.tenantId,
        rtbItemId,
        cycleKey,
        amount: c.finalAmount!,
        createdBy: "00000000-0000-0000-0000-000000000000",
        updatedBy: "00000000-0000-0000-0000-000000000000",
      },
    });
    written += 1;
  }

  console.log(`  ✓ ${written} Aufteilungen geschrieben, ${skipped} bereits vorhanden\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
