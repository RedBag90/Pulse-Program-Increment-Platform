/* eslint-disable no-console */
/**
 * Einmal-Skript: die Phase `hypothesis_review` abräumen.
 *
 * Die Hypothesen-Freigabe ist in den Reifegrad-Schritt L0 → L1 aufgegangen — die
 * Abnahme dieses Schritts *ist* sie. Damit entfaellt die eigene Phase; ein Epic,
 * das noch darin steht, hat einen unentschiedenen Lauf und gehoert zurueck auf
 * `draft`: es steht wieder vor dem L0→L1-Antrag.
 *
 * Zusaetzlich gemeldet (nicht angefasst): Epics, die `hypothesisApprovedAt`
 * tragen, aber noch auf `stageGate = "L0"` stehen. Sie haben die alte Freigabe
 * hinter sich, den Reifegrad-Wechsel aber nie beantragt. Der Stempel ist
 * set-once — der naechste Antrag laesst ihn stehen und ist trotzdem korrekt.
 *
 * Idempotent: ein zweiter Lauf findet keine Kandidaten mehr.
 *
 * Aufruf: pnpm tsx prisma/scripts/2026-08-30-hypothesis-review-phase-retire.ts
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { count } = await prisma.initiative.updateMany({
    where: { level: 0, deletedAt: null, approvalPhase: "hypothesis_review" },
    data: { approvalPhase: "draft" },
  });
  console.log(`Epics aus "hypothesis_review" auf "draft" zurueckgesetzt: ${count}`);

  const stray = await prisma.initiative.findMany({
    where: {
      level: 0,
      deletedAt: null,
      stageGate: "L0",
      hypothesisApprovedAt: { not: null },
    },
    select: { id: true, title: true },
  });
  if (stray.length > 0) {
    console.warn(
      `Hinweis: ${stray.length} Epic(s) tragen eine alte Hypothesen-Freigabe, stehen aber ` +
        `noch auf L0. Sie erfuellen das neue L1-Kriterium und wandern beim naechsten Antrag:\n` +
        stray.map((e) => `  - ${e.id} ${e.title}`).join("\n"),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
