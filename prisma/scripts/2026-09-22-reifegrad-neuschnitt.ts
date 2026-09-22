/* eslint-disable no-console */
/**
 * Einmal-Skript: **Reifegrad-Neuschnitt September 2026.**
 *
 * „Zur Analyse ausgewaehlt" ist kein Reifegrad mehr, sondern ein Gate ohne
 * Nummer (`analysis`). Was darauf folgte, sind zwei eigene Grade geworden:
 *
 *     alt                              neu
 *     L2  zur Analyse ausgewaehlt  ->  L1 + Stempel `selectedForAnalyzingAt`
 *     L3.1 BC freigegeben          ->  L2
 *     L3.2 Budget alloziert        ->  L3
 *     L0, L1, L4, L4.2, L5             unveraendert
 *
 * **Die Zuordnung ist verlustfrei ableitbar**, und das ist der Grund, warum
 * dieses Skript ohne Raten auskommt:
 *
 *  - Jedes Epic auf `stageGate = "L2"` traegt bereits `selectedForAnalyzingAt`
 *    (gemessen: 31 von 31). Es faellt auf L1 zurueck und behaelt den Stempel —
 *    der Schritt ist gegangen, er heisst nur nicht mehr wie ein Grad.
 *  - Jedes Epic auf `"L3"` trennt sich am `approvedAt`: ohne ihn stand es auf
 *    L3.1 (BC freigegeben) und wird **L2**, mit ihm auf L3.2 (Budget alloziert)
 *    und bleibt **L3**.
 *
 * Dazu die Historie: `stage_gate_transitions.from_gate/to_gate` und
 * `stage_gate_approver_rules.to_gate` halten **Schritte**, nicht Grade — dort
 * wird `L2 -> analysis`, `L3.1 -> L2`, `L3.2 -> L3` umgeschrieben. Das
 * `readiness`-JSON bleibt, wie es ist: es haelt den Stand zum Antragszeitpunkt
 * fest, und den hat dieser Schnitt nicht geaendert.
 *
 * **Reihenfolge ist wichtig.** Erst die Historie (dort ist `L2` eindeutig der
 * alte Analyse-Schritt), dann die Epics. Umgekehrt liesse sich der neue Grad L2
 * nicht mehr vom alten Schritt L2 unterscheiden.
 *
 * Idempotent: ein zweiter Lauf findet keine Kandidaten mehr.
 *
 * Aufruf: `npx tsx --env-file=.env.local prisma/scripts/2026-09-22-reifegrad-neuschnitt.ts`
 *         `--apply` schreibt; ohne das Flag ist es ein Trockenlauf.
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** Schritt-Umbenennungen in der Historie, in dieser Reihenfolge. */
const STEP_RENAMES: Array<[alt: string, neu: string]> = [
  ["L2", "analysis"],
  ["L3.1", "L2"],
  ["L3.2", "L3"],
];

async function main(): Promise<void> {
  console.log(APPLY ? "== SCHREIBLAUF ==" : "== TROCKENLAUF (kein --apply) ==");

  // ── 1 · Bestandsaufnahme ────────────────────────────────────────────────
  const l2 = await prisma.initiative.count({
    where: { level: 0, deletedAt: null, stageGate: "L2" },
  });
  const l2ohneStempel = await prisma.initiative.count({
    where: { level: 0, deletedAt: null, stageGate: "L2", selectedForAnalyzingAt: null },
  });
  const l3bc = await prisma.initiative.count({
    where: { level: 0, deletedAt: null, stageGate: "L3", approvedAt: null },
  });
  const l3geld = await prisma.initiative.count({
    where: { level: 0, deletedAt: null, stageGate: "L3", approvedAt: { not: null } },
  });

  console.log(`Epics L2 -> L1          : ${l2}  (davon ohne Analyse-Stempel: ${l2ohneStempel})`);
  console.log(`Epics L3 -> L2 (BC frei): ${l3bc}`);
  console.log(`Epics L3 -> L3 (Budget) : ${l3geld}  — unveraendert`);

  if (l2ohneStempel > 0) {
    // Der Stempel ist die einzige Auskunft darueber, dass der Schritt gegangen
    // wurde. Fehlt er, wuerde das Epic auf L1 landen und aussehen, als haette
    // die Analyse nie stattgefunden — ein stiller Rueckschritt.
    console.warn(
      `\n!! ${l2ohneStempel} Epic(s) auf L2 ohne selectedForAnalyzingAt.\n` +
        `   Sie wuerden ihren Schritt verlieren. Abbruch — bitte erst klaeren.`,
    );
    if (APPLY) process.exitCode = 1;
    if (APPLY) return;
  }

  // ── 2 · Historie: Schritte umbenennen ───────────────────────────────────
  for (const [alt, neu] of STEP_RENAMES) {
    const von = await prisma.stageGateTransition.count({ where: { fromGate: alt } });
    const nach = await prisma.stageGateTransition.count({ where: { toGate: alt } });
    const regeln = await prisma.stageGateApproverRule.count({ where: { toGate: alt } });
    console.log(`Schritt ${alt} -> ${neu}: ${von} fromGate, ${nach} toGate, ${regeln} Regeln`);

    if (!APPLY) continue;
    await prisma.stageGateTransition.updateMany({
      where: { fromGate: alt },
      data: { fromGate: neu },
    });
    await prisma.stageGateTransition.updateMany({ where: { toGate: alt }, data: { toGate: neu } });
    await prisma.stageGateApproverRule.updateMany({
      where: { toGate: alt },
      data: { toGate: neu },
    });
  }

  // ── 3 · Die Epics ───────────────────────────────────────────────────────
  if (APPLY) {
    // Zuerst L3 -> L2, dann L2 -> L1. Andersherum wuerden die eben nach L1
    // gewanderten Epics nicht mehr getroffen — aber die frisch auf L2
    // gesetzten faelschlich ein zweites Mal.
    const bc = await prisma.initiative.updateMany({
      where: { level: 0, deletedAt: null, stageGate: "L3", approvedAt: null },
      data: { stageGate: "L2" },
    });
    const analyse = await prisma.initiative.updateMany({
      where: {
        level: 0,
        deletedAt: null,
        stageGate: "L2",
        selectedForAnalyzingAt: { not: null },
        // Die eben gewanderten tragen keinen Analyse-Stempel aus L3 — aber
        // sicher ist sicher: `businessCaseApprovedAt` haben nur sie.
        businessCaseApprovedAt: null,
      },
      data: { stageGate: "L1" },
    });
    console.log(`\ngeschrieben: ${bc.count} Epics L3->L2, ${analyse.count} Epics L2->L1`);
  }

  // ── 4 · Was uebrig bleibt ───────────────────────────────────────────────
  const reste = await prisma.stageGateApproverRule.groupBy({ by: ["toGate"], _count: true });
  console.log("\nAbnehmer-Regeln je toGate danach:");
  for (const r of reste.sort((a, b) => a.toGate.localeCompare(b.toGate))) {
    console.log(`  ${r.toGate.padEnd(10)} ${r._count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
