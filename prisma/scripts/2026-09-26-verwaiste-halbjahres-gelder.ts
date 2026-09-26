/* eslint-disable no-console */
/**
 * Einmal-Skript: **Geld ohne Beschluss dahinter entfernen.**
 *
 * Bis September 2026 räumte `deletePeriod` nur die Runde ab. Das Geld eines
 * Halbjahres liegt aber nur am `cycleKey`, nicht an der Runde:
 *
 *  - `rtb_item_awards`            — ART-Topf (`art_change`) und Run-Zuspruch
 *  - `art_epic_allocations`       — was ein ART an Epics weitergab
 *  - `art_own_work_allocations`   — was ein ART für eigene Arbeit reservierte
 *  - `budget_allocations.allocations[cycleKey]` — Epic-Budgets
 *
 * Es überlebte das Löschen der Kachel. Gemeldet: nach dem Löschen standen im
 * ART „Projektteam" weiter 200.000 € zu verteilen — und eine neue Entwurfs-
 * Kachel desselben Halbjahres übernahm den Topf still.
 *
 * **Verwaist** heisst hier: zu diesem Mandanten und `cycleKey` gibt es keine
 * Runde im Stand `decided` oder `closed` — also keinen Beschluss, der das Geld
 * trägt. (Ein Entwurf trägt keins.) Das ist dieselbe Grenze wie beim Schreiben:
 * `saveRtbAwards` verlangt einen festgeschriebenen Kandidaten.
 *
 * Die Bereinigung tut, was `deletePeriod` seit diesem Stand beim Löschen tut
 * (`src/modules/budgeting/server/services/cycle-money.ts`) — nur nachträglich.
 *
 * Idempotent: ein zweiter Lauf findet nichts mehr.
 *
 * Aufruf: `npx tsx --env-file=.env.local prisma/scripts/2026-09-26-verwaiste-halbjahres-gelder.ts`
 *         `--apply` schreibt; ohne das Flag ist es ein Trockenlauf.
 *         `--tenant=<Name>` beschränkt auf einen Mandanten (exakter Name).
 */
import { PrismaClient, type Prisma } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const NUR_MANDANT = process.argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length);
const BESCHLOSSEN = ["decided", "closed"];

const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function amountIn(allocations: unknown, cycleKey: string): number {
  if (allocations == null || typeof allocations !== "object") return 0;
  const n = Number((allocations as Record<string, unknown>)[cycleKey]);
  return Number.isFinite(n) ? n : 0;
}

async function main(): Promise<void> {
  console.log(APPLY ? "== SCHREIBLAUF ==" : "== TROCKENLAUF (kein --apply) ==");

  const [tenants, runden, awards, epicAllocs, ownWork, budgets] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, name: true } }),
    prisma.budgetRound.findMany({ select: { tenantId: true, cycleKey: true, status: true } }),
    prisma.rtbItemAward.findMany({
      select: {
        tenantId: true,
        cycleKey: true,
        amount: true,
        rtbItem: { select: { kind: true, name: true, artId: true } },
      },
    }),
    prisma.artEpicAllocation.findMany({ select: { tenantId: true, cycleKey: true, amount: true } }),
    prisma.artOwnWorkAllocation.findMany({
      select: { tenantId: true, cycleKey: true, amount: true },
    }),
    prisma.budgetAllocation.findMany({
      select: { id: true, tenantId: true, epicId: true, allocations: true },
    }),
  ]);

  const name = new Map(tenants.map((t) => [t.id, t.name]));
  const beschlossen = new Set(
    runden.filter((r) => BESCHLOSSEN.includes(r.status)).map((r) => `${r.tenantId}|${r.cycleKey}`),
  );
  const entwurf = new Set(
    runden.filter((r) => !BESCHLOSSEN.includes(r.status)).map((r) => `${r.tenantId}|${r.cycleKey}`),
  );

  // Alle (Mandant, Halbjahr), unter denen Geld liegt.
  const schluessel = new Set<string>();
  for (const a of awards) schluessel.add(`${a.tenantId}|${a.cycleKey}`);
  for (const a of epicAllocs) schluessel.add(`${a.tenantId}|${a.cycleKey}`);
  for (const a of ownWork) schluessel.add(`${a.tenantId}|${a.cycleKey}`);
  for (const b of budgets) {
    for (const k of Object.keys((b.allocations ?? {}) as Record<string, unknown>)) {
      schluessel.add(`${b.tenantId}|${k}`);
    }
  }

  const erlaubt =
    NUR_MANDANT == null
      ? null
      : new Set(tenants.filter((t) => t.name === NUR_MANDANT).map((t) => t.id));
  if (erlaubt != null && erlaubt.size === 0) {
    console.log(`Kein Mandant mit dem Namen „${NUR_MANDANT}".`);
    return;
  }
  const verwaist = [...schluessel]
    .filter((k) => !beschlossen.has(k))
    .filter((k) => erlaubt == null || erlaubt.has(k.split("|")[0]!))
    .sort();
  if (verwaist.length === 0) {
    console.log("Nichts verwaist.");
    return;
  }

  for (const k of verwaist) {
    const [tenantId, cycleKey] = k.split("|") as [string, string];
    const hier = <T extends { tenantId: string; cycleKey: string }>(xs: T[]) =>
      xs.filter((x) => x.tenantId === tenantId && x.cycleKey === cycleKey);

    const aw = hier(awards);
    const art = aw.filter((a) => a.rtbItem.kind === "art_change");
    const run = aw.filter((a) => a.rtbItem.kind !== "art_change");
    const ea = hier(epicAllocs);
    const ow = hier(ownWork);
    const ebs = budgets.filter(
      (b) => b.tenantId === tenantId && amountIn(b.allocations, cycleKey) !== 0,
    );
    const sum = (xs: { amount: unknown }[]) => xs.reduce((s, x) => s + Number(x.amount), 0);

    console.log(
      `\n── ${name.get(tenantId) ?? tenantId} · ${cycleKey}` +
        (entwurf.has(k) ? "  (nur eine Entwurfs-Kachel, kein Beschluss)" : "  (keine Kachel)"),
    );
    for (const a of art)
      console.log(`   ART-Topf   ${eur(Number(a.amount)).padStart(14)}  ${a.rtbItem.name}`);
    for (const a of run)
      console.log(`   Run        ${eur(Number(a.amount)).padStart(14)}  ${a.rtbItem.name}`);
    if (ea.length) console.log(`   ART→Epics  ${eur(sum(ea)).padStart(14)}  (${ea.length} Zeilen)`);
    if (ow.length) console.log(`   ART eigen  ${eur(sum(ow)).padStart(14)}  (${ow.length} Zeilen)`);
    for (const b of ebs) {
      console.log(
        `   Epic-Budget${eur(amountIn(b.allocations, cycleKey)).padStart(14)}  Epic ${b.epicId}`,
      );
    }

    if (!APPLY) continue;
    await prisma.$transaction(async (tx) => {
      await tx.rtbItemAward.deleteMany({ where: { tenantId, cycleKey } });
      await tx.artEpicAllocation.deleteMany({ where: { tenantId, cycleKey } });
      await tx.artOwnWorkAllocation.deleteMany({ where: { tenantId, cycleKey } });
      for (const b of budgets.filter((x) => x.tenantId === tenantId)) {
        const karte = (b.allocations ?? {}) as Record<string, unknown>;
        if (!(cycleKey in karte)) continue;
        const { [cycleKey]: _weg, ...rest } = karte;
        if (Object.keys(rest).length === 0) {
          await tx.budgetAllocation.delete({ where: { id: b.id } });
          b.allocations = {}; // für spätere Halbjahre desselben Laufs: nichts mehr da
        } else {
          await tx.budgetAllocation.update({
            where: { id: b.id },
            data: { allocations: rest as Prisma.InputJsonValue },
          });
          b.allocations = rest as Prisma.JsonValue;
        }
      }
    });
    console.log("   → entfernt");
  }

  if (!APPLY) console.log("\nTrockenlauf — mit --apply ausführen, um zu entfernen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
