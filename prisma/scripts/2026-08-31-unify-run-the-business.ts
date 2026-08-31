/* eslint-disable no-console */
/**
 * Vereinheitlichung von **Run the Business**: die Run-Baseline der Solution zieht
 * als Run-the-Business-Position um.
 *
 * Betriebskosten wurden an zwei Stellen gepflegt, die nichts voneinander
 * wussten: `Solution.runBaselineAmount` (eine Zahl, reine Anzeige, nie
 * budgetiert) und `RunTheBusinessItem` (benannte Positionen je Wertstrom, die
 * als Ballot-Kandidaten mitbudgetiert werden, aber keiner Solution zurechenbar
 * waren). Ab jetzt trägt die Position beides — die Zurechnung (`solutionId`,
 * optional) und die Periode (`interval`).
 *
 * Dieses Skript legt je Solution mit gesetzter Baseline **eine** jährliche
 * Position an. Sie ist ab dann Ballot-Kandidat: genau der Sinn der Übung, aber
 * es vergrößert den Ask der nächsten Kachel. Wer das nicht will, deaktiviert sie
 * im Wertstrom.
 *
 * Die Bestandszeilen bleiben unberührt. Sie stehen per Spalten-Default auf
 * `half_yearly` — genau das bedeutete ihr Betrag bisher (er ging 1:1 als Ask in
 * eine Halbjahres-Kachel), also verschiebt sich kein einziger existierender Ask.
 *
 * Gelesen wird die Baseline per Raw-SQL mit `information_schema`-Prüfung, nicht
 * über den Prisma-Client: so ist das Skript unabhängig davon, ob `db push` die
 * Spalte schon entfernt hat, und in beiden Reihenfolgen sicher.
 *
 * Idempotent über (`solutionId`, Name) — ein zweiter Lauf legt nichts an.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-31-unify-run-the-business.ts [--dry]
 */

import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

interface BaselineRow {
  id: string;
  tenant_id: string;
  value_stream_id: string;
  name: string;
  run_baseline_amount: string | number;
  /** Wer die Solution zuletzt angefasst hat — der Umzug schreibt in seinem Namen. */
  updated_by: string;
}

/** `true`, solange `solutions.run_baseline_amount` noch existiert. */
async function baselineColumnExists(): Promise<boolean> {
  const rows = (await prisma.$queryRawUnsafe(
    `select 1 as one from information_schema.columns
      where table_name = 'solutions' and column_name = 'run_baseline_amount'`,
  )) as unknown[];
  return rows.length > 0;
}

async function main(): Promise<void> {
  if (!(await baselineColumnExists())) {
    console.log("Spalte `solutions.run_baseline_amount` ist bereits entfernt — nichts zu tun.");
    return;
  }

  const rows = (await prisma.$queryRawUnsafe(
    `select id, tenant_id, value_stream_id, name, run_baseline_amount, updated_by
       from solutions
      where run_baseline_amount is not null and deleted_at is null
      order by name`,
  )) as BaselineRow[];

  console.log(`Solutions mit Run-Baseline: ${rows.length}${DRY ? "  (dry run)" : ""}`);

  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    const name = `Betrieb ${r.name}`;
    const existing = await prisma.runTheBusinessItem.findFirst({
      where: { tenantId: r.tenant_id, solutionId: r.id, name },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    created += 1;
    if (DRY) {
      console.log(`  + ${name}  ${Number(r.run_baseline_amount).toLocaleString("de-DE")} € / Jahr`);
      continue;
    }
    await prisma.runTheBusinessItem.create({
      data: {
        tenantId: r.tenant_id,
        valueStreamId: r.value_stream_id,
        solutionId: r.id,
        name,
        plannedAmount: Number(r.run_baseline_amount),
        interval: "yearly",
        active: true,
        createdBy: r.updated_by,
        updatedBy: r.updated_by,
      },
    });
  }

  console.log(`  ✓ ${created} Positionen angelegt, ${skipped} bereits vorhanden`);
  console.log("  → danach `prisma db push`, um die Spalte zu entfernen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
