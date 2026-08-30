/* eslint-disable no-console */
/**
 * Nachzug der **Plan-Schnappschüsse** für Epics, deren Business Case vor der
 * Einführung des Schnappschusses freigegeben wurde.
 *
 * Der Schnappschuss ist der feste Bezugspunkt, gegen den Plan und Ist gemessen
 * werden: er hält fest, was bei der Freigabe des Business Case (L2 → L3.1)
 * versprochen war — die Zielspanne der Erfolgs-KPI und den Umrechnungsfaktor.
 * Ohne ihn misst sich der Plan an sich selbst: zieht Finance den Faktor
 * zwischen L4.2 und L5 nach, verschiebt sich Plan **und** Ist gleichzeitig, und
 * die Korrektur bleibt folgenlos unsichtbar.
 *
 * Geschrieben wird der **heutige Live-Stand** aller Epics mit gesetztem
 * `businessCaseApprovedAt`. Das ist ehrlich gesagt ein nachträglich erfundener
 * Plan: was seit der Freigabe verändert wurde, ist nicht mehr rekonstruierbar
 * und zählt hier als „so war es versprochen". Für alles ab heute zieht die
 * Abnahme selbst den Schnappschuss (`snapshotPlanTerms`), und der ist echt.
 *
 * Set-once wie im Live-Pfad: ein vorhandener Schnappschuss wird nie
 * überschrieben. Idempotent — ein zweiter Lauf findet 0 Kandidaten.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-30-plan-snapshot-backfill.ts [--dry]
 */

import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  const epics = await prisma.initiative.findMany({
    where: { level: 0, deletedAt: null, businessCaseApprovedAt: { not: null } },
    select: { id: true, title: true, stageGate: true },
  });
  console.log(`Epics mit freigegebenem Business Case: ${epics.length}${DRY ? "  (dry run)" : ""}`);

  const epicIds = epics.map((e) => e.id);
  if (epicIds.length === 0) return;

  // Auf `planSnapshot: null` wird in JS gefiltert statt im `where`: Prismas
  // Json-Null-Filter verlangt den Laufzeit-Wert `Prisma.DbNull`, und die Menge
  // ist klein genug, um sie ganz zu laden.
  const kpis = await prisma.kpi.findMany({
    where: { initiativeId: { in: epicIds } },
    select: {
      id: true,
      planSnapshot: true,
      baseline: true,
      target: true,
      valuePerUnit: true,
      benefitKind: true,
      recurringInterval: true,
    },
  });
  let kpiWritten = 0;
  for (const k of kpis) {
    if (k.planSnapshot != null) continue;
    kpiWritten += 1;
    if (DRY) continue;
    await prisma.kpi.update({
      where: { id: k.id },
      data: {
        planSnapshot: {
          baseline: num(k.baseline),
          target: num(k.target),
          valuePerUnit: num(k.valuePerUnit),
          benefitKind: k.benefitKind,
          recurringInterval: k.recurringInterval,
        },
      },
    });
  }

  const links = await prisma.goalEpicLink.findMany({
    where: { epicId: { in: epicIds } },
    select: {
      id: true,
      planSnapshot: true,
      conversionFactor: true,
      impactKind: true,
      recurringInterval: true,
    },
  });
  let linkWritten = 0;
  for (const l of links) {
    if (l.planSnapshot != null) continue;
    linkWritten += 1;
    if (DRY) continue;
    await prisma.goalEpicLink.update({
      where: { id: l.id },
      data: {
        planSnapshot: {
          conversionFactor: num(l.conversionFactor),
          impactKind: l.impactKind,
          recurringInterval: l.recurringInterval,
        },
      },
    });
  }

  console.log(`  ✓ KPIs:            ${kpiWritten} von ${kpis.length} festgeschrieben`);
  console.log(`  ✓ Ziel-Verbindungen: ${linkWritten} von ${links.length} festgeschrieben`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
