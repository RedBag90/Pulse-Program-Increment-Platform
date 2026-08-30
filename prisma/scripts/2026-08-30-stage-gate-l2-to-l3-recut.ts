/* eslint-disable no-console */
/**
 * Einmal-Skript: Reifegrad-Neuschnitt L2 / L3.
 *
 * Die Sub-Stage „L2.2 Business Case freigegeben" ist zu **L3.1** geworden, das
 * frühere Haupt-Gate „L3 Budget alloziert" zu **L3.2**. Damit betritt ein Epic
 * L3 nicht mehr mit dem Budget, sondern mit der freigegebenen
 * Business-Case-Freigabe; die Investitionsentscheidung ist der Schritt danach.
 *
 * Was zu tun ist: Epics, die auf `stageGate = "L2"` stehen und einen
 * `businessCaseApprovedAt`-Stempel tragen, standen fachlich auf L2.2 und stehen
 * jetzt auf L3.1 — ihre Spalte wandert auf "L3". Alles andere bleibt:
 *
 *  - Epics auf "L2" ohne BC-Freigabe bleiben auf L2 (das ist jetzt „BC in Arbeit").
 *  - Epics auf "L3" bleiben auf L3; sie tragen `approvedAt` und werden damit
 *    als L3.2 gelesen.
 *  - L4/L5 bleiben unberührt.
 *
 * Idempotent: ein zweiter Lauf findet keine Kandidaten mehr.
 *
 * Aufruf: pnpm tsx prisma/scripts/2026-08-30-stage-gate-l2-to-l3-recut.ts
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const candidates = await prisma.initiative.findMany({
    where: {
      level: 0,
      deletedAt: null,
      stageGate: "L2",
      businessCaseApprovedAt: { not: null },
    },
    select: { id: true, title: true, approvedAt: true },
  });

  if (candidates.length === 0) {
    console.log("Keine Kandidaten — nichts zu tun.");
    return;
  }

  const { count } = await prisma.initiative.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { stageGate: "L3" },
  });
  console.log(`Auf L3 (= L3.1) verschoben: ${count}`);

  // Hinweis, kein Eingriff: ein `approvedAt` an einem dieser Epics wuerde sie
  // sofort als L3.2 lesen lassen, obwohl die Investition nie abgenommen wurde.
  // Der Stempel wurde frueher beim Erreichen von L3 gesetzt — auf L2 stehende
  // Epics sollten ihn nicht tragen.
  const stamped = candidates.filter((c) => c.approvedAt != null);
  if (stamped.length > 0) {
    console.warn(
      `WARNUNG: ${stamped.length} davon tragen bereits approvedAt und erscheinen ` +
        `damit als L3.2 statt L3.1:\n` +
        stamped.map((c) => `  - ${c.id} ${c.title}`).join("\n"),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
