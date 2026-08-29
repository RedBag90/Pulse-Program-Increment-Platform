/* eslint-disable no-console */
/**
 * Backfill für den Rückbau der Fortschrittsquelle `auto_kpi`
 * („Aus verknüpften KPIs").
 *
 * `auto_kpi` war fachlich redundant: ein `kpi_tree`-**Blatt** rechnet identisch
 * (Ist aus den verknüpften Epic-KPIs, Δ×Faktor). Alle gespeicherten
 * `auto_kpi`-Ziele werden auf `kpi_tree` normalisiert; danach ist `kpi_tree`
 * der eine KPI-getriebene Modus. Bewusste Vereinheitlichung am Rand: ein
 * `auto_kpi`-Knoten, der (entgegen der Doku „Einzel-Blatt") Kinder hatte,
 * kaskadiert danach die Unterziel-Werte statt sein eigenes Blatt zu rechnen.
 *
 * Idempotent — wiederholte Läufe finden 0 Zeilen.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-29-auto-kpi-to-kpi-tree.ts
 */

import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const res = await prisma.objective.updateMany({
    where: { progressMode: "auto_kpi" },
    data: { progressMode: "kpi_tree" },
  });
  console.log(`✓ ${res.count} Ziel(e) von auto_kpi auf kpi_tree normalisiert.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
