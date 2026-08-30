/* eslint-disable no-console */
/**
 * Einmal-Skript: Zeilen der abgeschafften Sektions-Abnahme entfernen.
 *
 * Die Freigaben fuer „Deliverables" und „KPIs" liefen frueher als eigene
 * `EpicApproval`-Zeilen mit `kind = "section"`. Sie sind in der allgemeinen
 * Business-Case-Freigabe aufgegangen; der Code liest sie nicht mehr.
 *
 * Warum trotzdem loeschen: `hasRejection` und die Revisions-Uebertraege lasen
 * die Zeilen frueher ohne `kind`-Filter. Die Lesepfade sind jetzt auf
 * `kind: "party"` eingeschraenkt — aber eine liegengebliebene, abgelehnte
 * Sektionszeile waere trotzdem eine Stolperfalle fuer jede kuenftige Abfrage,
 * die den Filter vergisst. Die Spalten `kind`/`section` bleiben im Schema.
 *
 * Idempotent: ein zweiter Lauf loescht 0 Zeilen.
 *
 * Aufruf: pnpm tsx prisma/scripts/2026-08-30-drop-epic-approval-sections.ts
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { count } = await prisma.epicApproval.deleteMany({ where: { kind: "section" } });
  console.log(`Sektions-Freigabezeilen geloescht: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
