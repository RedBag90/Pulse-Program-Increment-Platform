/* eslint-disable no-console */
/**
 * **Ein Feature hat keinen Reifegrad — der Bestand sagt etwas anderes.**
 *
 * `stage_gate` sitzt auf der geteilten `initiatives`-Tabelle, ist NOT NULL und
 * traegt im Schema den Kommentar „(EPIC only)". Die Gate-Maschinerie filtert
 * durchgehend `level: EPIC`, und **kein Anlagepfad im Produkt** setzt den Wert
 * an einem Feature (`work/server/services/feature.ts`). Trotzdem stand er bis
 * September 2026 als Feld REIFEGRAD auf der Feature-Detailseite.
 *
 * Woher er kam: aus den Seeds, als Literal `stageGate: "L3"`. Gemessen am
 * 2026-09-20 trugen **alle 650** Features L3 — in 130 Faellen ein hoeherer
 * Reifegrad als das Epic darueber, was fachlich unmoeglich ist. (Die Zahlen
 * haengen am Seed-Stand; vor dem Lieferungs-Seed waren es 461 bzw. 282.)
 *
 * **Was `'L0'` heisst und was nicht.** Es ist der Schema-Default, nicht „der
 * richtige Reifegrad". Die Spalte ist NOT NULL; leer kann ein Feature sie ohne
 * DDL nicht tragen. Der Lauf stellt damit genau den unberuehrten Zustand her,
 * den jedes im Produkt angelegte Feature ohnehin hat.
 *
 * **Was der Lauf nicht anfasst:** keine Epic-Zeile (`level = 0`), keine
 * `stage_gate_transitions`, keine `stage_gate_approvals`. Beide Tabellen haengen
 * an Epics; an Features gibt es dort nichts, und der Lauf prueft das, statt es
 * anzunehmen.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Aenderungen.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-feature-reifegrad-zuruecksetzen.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-feature-reifegrad-zuruecksetzen.ts --apply
 */

import { prisma } from "../seed-helpers.js";

const APPLY = process.argv.includes("--apply");
const FEATURE = 1;
const EPIC = 0;
const DEFAULT_GATE = "L0";

async function main() {
  console.log(
    `\n🎚  Feature-Reifegrad → ${DEFAULT_GATE} — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`,
  );

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const namen = new Map(tenants.map((t) => [t.id, t.name]));

  const features = await prisma.initiative.findMany({
    where: { level: FEATURE },
    select: { id: true, tenantId: true, stageGate: true, parent: { select: { stageGate: true } } },
  });

  const abweichend = features.filter((f) => f.stageGate !== DEFAULT_GATE);
  console.log(
    `Features gesamt: ${features.length} — davon nicht ${DEFAULT_GATE}: ${abweichend.length}`,
  );

  // Verteilung je Mandant und Wert, damit im Protokoll steht, was verschwindet.
  const jeMandant = new Map<string, Map<string, number>>();
  for (const f of abweichend) {
    const m = jeMandant.get(f.tenantId) ?? new Map<string, number>();
    m.set(f.stageGate, (m.get(f.stageGate) ?? 0) + 1);
    jeMandant.set(f.tenantId, m);
  }
  for (const [tenantId, verteilung] of jeMandant) {
    const teile = [...verteilung].sort().map(([g, n]) => `${g}=${n}`);
    console.log(`  ${(namen.get(tenantId) ?? tenantId).padEnd(24)} ${teile.join("  ")}`);
  }

  // **Der Widerspruch, der das Feld entlarvt hat.** Ein Feature kann nicht
  // reifer sein als das Epic, in dem es haengt — der Reifegrad gehoert dem Epic.
  const RANG = ["L0", "L1", "L2", "L3", "L4", "L5"];
  const ueberEltern = features.filter(
    (f) => f.parent != null && RANG.indexOf(f.stageGate) > RANG.indexOf(f.parent.stageGate),
  ).length;
  console.log(`\nDavon reifer als ihr Epic: ${ueberEltern} — fachlich unmoeglich.`);

  // Gegenprobe: an Features haengt keine Gate-Historie. Faende sich eine, waere
  // dieser Lauf zu grob und muesste zuerst besprochen werden.
  const featureIds = features.map((f) => f.id);
  const [transitions, approvals] = await Promise.all([
    prisma.stageGateTransition.count({ where: { initiativeId: { in: featureIds } } }),
    prisma.stageGateApproval.count({
      where: { transition: { initiativeId: { in: featureIds } } },
    }),
  ]);
  console.log(`Gate-Historie an Features: ${transitions} Transitions, ${approvals} Approvals.`);
  if (transitions > 0 || approvals > 0) {
    console.log("\n⛔  Es haengt Historie an Features. Abbruch — das gehoert besprochen.\n");
    process.exit(1);
  }

  const epics = await prisma.initiative.groupBy({
    by: ["stageGate"],
    where: { level: EPIC },
    _count: true,
  });
  console.log(
    `Epics (unberuehrt): ${epics
      .map((e) => `${e.stageGate}=${e._count}`)
      .sort()
      .join("  ")}`,
  );

  if (!APPLY) {
    console.log(`\nTrockenlauf — nichts geschrieben. Mit --apply ausfuehren.\n`);
    return;
  }
  if (abweichend.length === 0) {
    console.log(`\nNichts zu tun.\n`);
    return;
  }
  const res = await prisma.initiative.updateMany({
    where: { level: FEATURE, stageGate: { not: DEFAULT_GATE } },
    data: { stageGate: DEFAULT_GATE },
  });
  console.log(`\n✅  ${res.count} Feature(s) auf ${DEFAULT_GATE} gesetzt.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
