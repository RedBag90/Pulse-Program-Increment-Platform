/* eslint-disable no-console */
/**
 * Bestandsnamen nachziehen: „Veränderungsrahmen …" → „ART-Epic-Budget …".
 *
 * Die Umbenennung in Code, UI und Doku ließ die **gespeicherten Namen** der
 * Run-the-Business-Positionen unberührt — sie sind Daten, kein Text im Repo.
 * Auf der Fläche stand deshalb das neue Wort als Spaltenüberschrift über dem
 * alten Wort als Zeilenname.
 *
 * Nur `kind = "art_change"`: eine Betriebsposition, die zufällig so heißt, geht
 * uns nichts an. Idempotent — ein zweiter Lauf findet nichts mehr.
 *
 *     npx tsx prisma/scripts/2026-09-05-rename-art-epic-budget.ts
 */
import { prisma } from "../seed-helpers";

async function main() {
  const rows = await prisma.runTheBusinessItem.findMany({
    where: { kind: "art_change", name: { contains: "Veränderungsrahmen" } },
    select: { id: true, name: true },
  });
  if (rows.length === 0) {
    console.log("Nichts umzubenennen.");
    return;
  }

  for (const r of rows) {
    // „Veränderungsrahmen ART" (ohne Zusatz) wird schlicht zum Sachnamen.
    const next =
      r.name.trim() === "Veränderungsrahmen ART"
        ? "ART-Epic-Budget"
        : r.name.replace("Veränderungsrahmen", "ART-Epic-Budget");
    await prisma.runTheBusinessItem.update({ where: { id: r.id }, data: { name: next } });
    console.log(`  ${r.name}  →  ${next}`);
  }
  console.log(`${rows.length} Positionen umbenannt.`);
}

main().finally(() => prisma.$disconnect());
