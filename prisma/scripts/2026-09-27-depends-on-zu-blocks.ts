/* eslint-disable no-console */
/**
 * Einmal-Skript: **„depends_on"-Kanten werden „blocks" — so, wie sie gezeichnet
 * sind.**
 *
 * Der Abhängigkeitstyp „depends_on" / „hängt ab von" entfällt (September
 * 2026). Er bedeutete im Code zweierlei: gezeichnet (Netzplan, Gantt, Ziehen,
 * „Folge-Feature") war `from → to` „from zuerst", gerechnet (Blocker-Symbol,
 * Blocker-Fenster, PI-Prüfung) laut Katalog „from hängt ab von to", also `to`
 * zuerst. Übrig bleibt `blocks`, bei dem beides übereinstimmt.
 *
 * **Entschieden: wie gezeichnet.** Aus `depends_on(A→B)` wird `blocks(A→B)` —
 * die Enden bleiben, der Pfeil im Netzplan bleibt. In den geseedeten Mandanten
 * drehen sich damit die gemeinten Abhängigkeiten um (die Seeds schrieben sie
 * laut Katalog); künftige Seed-Läufe schreiben `blocks` richtig herum.
 *
 * **Doppelte:** trägt ein Paar schon `blocks(A→B)`, wird die `depends_on`-Zeile
 * gelöscht statt umgewandelt — der Unique-Index `(from_id, to_id, type)` ließe
 * das Update sonst scheitern.
 *
 * `from`/`to` ändern sich nicht, also auch nicht der Graph der Zyklenprüfung
 * (sie ist typblind). Der Zyklus-Trigger feuert nur bei INSERT.
 *
 * Idempotent: ein zweiter Lauf findet nichts mehr.
 *
 * Aufruf: `npx tsx --env-file=.env.local prisma/scripts/2026-09-27-depends-on-zu-blocks.ts`
 *         `--apply` schreibt; ohne das Flag ist es ein Trockenlauf.
 *         `--tenant=<Name>` beschränkt auf einen Mandanten (exakter Name).
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NUR_MANDANT = process.argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length);
const ALT = "depends_on";

async function main(): Promise<void> {
  console.log(APPLY ? "== SCHREIBLAUF ==" : "== TROCKENLAUF (kein --apply) ==");
  const tenants = await prisma.tenant.findMany({
    where: NUR_MANDANT == null ? {} : { name: NUR_MANDANT },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (tenants.length === 0) {
    console.log(`Kein Mandant mit dem Namen „${NUR_MANDANT}".`);
    return;
  }

  let gesamt = 0;
  for (const tenant of tenants) {
    const [alte, blocks] = await Promise.all([
      prisma.dependency.findMany({
        where: { tenantId: tenant.id, type: ALT },
        select: {
          id: true,
          fromId: true,
          toId: true,
          from: { select: { title: true } },
          to: { select: { title: true } },
        },
      }),
      prisma.dependency.findMany({
        where: { tenantId: tenant.id, type: "blocks" },
        select: { fromId: true, toId: true },
      }),
    ]);
    if (alte.length === 0) continue;

    const vorhanden = new Set(blocks.map((b) => `${b.fromId}>${b.toId}`));
    const doppelt = alte.filter((d) => vorhanden.has(`${d.fromId}>${d.toId}`));
    const umwandeln = alte.filter((d) => !vorhanden.has(`${d.fromId}>${d.toId}`));

    console.log(
      `\n── ${tenant.name}: ${umwandeln.length} umwandeln, ${doppelt.length} doppelt (löschen)`,
    );
    for (const d of doppelt) {
      console.log(`   doppelt: ${d.from.title} → ${d.to.title} (blocks besteht schon)`);
    }
    gesamt += alte.length;

    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      if (doppelt.length > 0) {
        await tx.dependency.deleteMany({ where: { id: { in: doppelt.map((d) => d.id) } } });
      }
      await tx.dependency.updateMany({
        where: { id: { in: umwandeln.map((d) => d.id) } },
        data: { type: "blocks" },
      });
    });
    console.log("   → umgestellt");
  }

  if (gesamt === 0) console.log("Nichts umzustellen.");
  else if (!APPLY) console.log(`\n${gesamt} Kanten — mit --apply umstellen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
