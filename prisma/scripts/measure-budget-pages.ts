/* eslint-disable no-console */
/**
 * Zählt die Datenbank-Abfragen der drei Budget-Flächen.
 *
 * Der Maßstab für den Umbau des Budget-Moduls: jede Stufe soll ihre Wirkung in
 * Abfragen ausweisen, nicht in Behauptungen. Das Skript ruft **dieselben
 * Loader**, die die Seiten rufen — nicht die Seiten selbst, weil deren
 * Auth-Schicht einen echten Request bräuchte. Die 4–5 Abfragen für Principal
 * und Target-Model fehlen deshalb; sie sind auf allen Flächen gleich und
 * kommen aus dem Layout.
 *
 *     npx tsx prisma/scripts/measure-budget-pages.ts
 */
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { loadEnvLocal } from "../seed-helpers";

loadEnvLocal();

interface Probe {
  label: string;
  run: (db: PrismaClient, ctx: Ctx) => Promise<unknown>;
}

interface Ctx {
  tenantId: string;
  tenantName: string;
  valueStreamId: string;
  artId: string;
  artCount: number;
  cycleKey: string;
}

/** Ein Client, der jede Abfrage mitzählt. */
function countingClient(): { db: PrismaClient; take: () => string[] } {
  const seen: string[] = [];
  const db = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL! } },
    log: [{ emit: "event", level: "query" }],
  });
  db.$on("query", (e: { query: string }) => {
    // Transaktions-Rahmen zählen nicht als Arbeit.
    const q = e.query.trim();
    if (/^(BEGIN|COMMIT|ROLLBACK|DEALLOCATE|SELECT 1)/i.test(q)) return;
    seen.push(q);
  });
  return {
    db,
    take: () => {
      const out = [...seen];
      seen.length = 0;
      return out;
    },
  };
}

/** Aus welchen Tabellen liest eine Abfrage? Für die Aufschlüsselung. */
function tableOf(sql: string): string {
  const m = /(?:FROM|INTO|UPDATE)\s+"?[\w]*"?\.?"?([\w_]+)"?/i.exec(sql);
  return m?.[1] ?? "?";
}

const PROBES: Probe[] = [
  {
    label: "A · /budgeting/arts (Liste)",
    run: async (db, c) => {
      const { loadArtEpicBudgets } =
        await import("../../src/modules/budgeting/server/services/art-epic-budget");
      const arts = await db.art.findMany({
        where: { tenantId: c.tenantId },
        select: { id: true, name: true, valueStream: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      });
      return loadArtEpicBudgets(
        db,
        c.tenantId,
        arts.map((a) => a.id),
        c.cycleKey,
      );
    },
  },
  {
    label: "B · /budgeting/arts/[artId] (Detail)",
    run: async (db, c) => {
      const { loadArtBudgetDetail } =
        await import("../../src/modules/budgeting/server/views/art-budget-detail");
      const { loadFundingPhases } =
        await import("../../src/modules/budgeting/server/views/art-funding");
      const art = await db.art.findFirst({
        where: { id: c.artId, tenantId: c.tenantId },
        select: { id: true, valueStreamId: true },
      });
      if (!art) return null;
      return Promise.all([
        loadArtBudgetDetail(
          db,
          c.tenantId as never,
          { id: art.id, valueStreamId: art.valueStreamId },
          { cycleKey: c.cycleKey, artEpics: true, threshold: 100_000 },
        ),
        loadFundingPhases(db, c.tenantId as never, art.valueStreamId, c.cycleKey, art.id),
      ]);
    },
  },
  {
    label: "C · /budgeting/value-streams/[id] · Reiter Budget",
    run: async (db, c) => {
      const { loadFundingPhases } =
        await import("../../src/modules/budgeting/server/views/art-funding");
      const { getValueStreamBudget } =
        await import("../../src/modules/budgeting/server/services/budgeting");
      const { loadArtGridModel } =
        await import("../../src/modules/budgeting/server/views/art-budget-breakdown");
      const { loadValueStreamCourse } =
        await import("../../src/modules/budgeting/server/views/value-stream-course");
      await loadFundingPhases(db, c.tenantId as never, c.valueStreamId, c.cycleKey);
      return Promise.all([
        getValueStreamBudget(db, c.tenantId as never, c.valueStreamId as never),
        loadArtGridModel(db, c.tenantId as never, c.valueStreamId as never),
        loadValueStreamCourse(db, c.tenantId as never, c.valueStreamId, {
          cycleKey: c.cycleKey,
        }),
      ]);
    },
  },
];

async function contextFor(
  db: PrismaClient,
  tenantId: string,
  tenantName: string,
): Promise<Ctx | null> {
  // Bevorzugt ein ART, der tatsächlich ein ART-Epic-Budget trägt — sonst misst
  // man den Kurzschluss statt des Ladepfads.
  const withBudget = await db.runTheBusinessItem.findFirst({
    where: { tenantId, kind: "art_change", artId: { not: null } },
    select: { artId: true },
  });
  const art = withBudget?.artId
    ? await db.art.findFirst({
        where: { id: withBudget.artId },
        select: { id: true, valueStreamId: true },
      })
    : null;
  const fallback =
    art ??
    (await db.art.findFirst({ where: { tenantId }, select: { id: true, valueStreamId: true } }));
  if (!fallback) return null;
  const artCount = await db.art.count({
    where: { tenantId, valueStreamId: fallback.valueStreamId },
  });
  const award = await db.rtbItemAward.findFirst({
    where: { tenantId },
    select: { cycleKey: true },
  });
  return {
    tenantId,
    tenantName,
    valueStreamId: fallback.valueStreamId,
    artId: fallback.id,
    artCount,
    cycleKey: award?.cycleKey ?? "2026-H2",
  };
}

async function main() {
  const { db, take } = countingClient();
  const tenants = await db.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  for (const t of tenants) {
    const ctx = await contextFor(db, t.id, t.name);
    if (!ctx) continue;
    console.log(
      `\n━━ ${t.name} — ${ctx.artCount} ARTs im gemessenen Wertstrom, Zyklus ${ctx.cycleKey}`,
    );
    for (const probe of PROBES) {
      take(); // Zähler leeren
      try {
        await probe.run(db, ctx);
      } catch (err) {
        console.log(`  ${probe.label}: FEHLER — ${(err as Error).message.split("\n")[0]}`);
        continue;
      }
      const qs = take();
      const byTable = new Map<string, number>();
      for (const q of qs) byTable.set(tableOf(q), (byTable.get(tableOf(q)) ?? 0) + 1);
      const top = [...byTable.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([tbl, n]) => `${tbl}×${n}`)
        .join(", ");
      console.log(`  ${probe.label.padEnd(46)} ${String(qs.length).padStart(4)} Abfragen   ${top}`);
    }
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
