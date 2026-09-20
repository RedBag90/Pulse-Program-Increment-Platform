/* eslint-disable no-console */
/**
 * **`platform_admin` ist keine Mandanten-Rolle.**
 *
 * Die Rolle ist das globale Kennzeichen eines Plattform-Admins und lebt als
 * genau **eine** Zuweisung im eigenen privaten Bereich des Inhabers
 * (`ensurePlatformAdminBootstrap`, `setPlatformRole`). Im Bestand lag sie
 * daneben in fremden Privatbereichen und in Organisationen — und weil
 * `authorize()` die Rolle bis September 2026 am Fast-Path vorbeiliess, war das
 * voller Lese- und Schreibzugriff auf fremde Inhalte.
 *
 * Dieses Skript lässt je Inhaber **genau eine** Zeile stehen — den Träger des
 * Kennzeichens — und entfernt alle übrigen. Bevorzugt bleibt die Zeile im
 * eigenen Bereich („eigen" = ein privater Mandant, in dem derselbe Nutzer
 * `tenant_admin` ist, also die beim Anlegen entstandene Zuweisung); gibt es
 * keine, bleibt die älteste.
 *
 * **Warum nicht einfach „alles ausserhalb des eigenen Bereichs weg":** der
 * Trockenlauf im Bestand zeigte zwei Plattform-Admins, die ihre Rolle
 * ausschliesslich in Organisationen halten und gar keinen eigenen privaten
 * Bereich haben. Die einfache Regel hätte sie stillschweigend degradiert.
 * Nach dem Wegfall des `authorize()`-Fast-Path ist eine verbleibende Zeile in
 * einer Organisation ohne Wirkung auf Inhalte — sie trägt nur noch das
 * Kennzeichen.
 *
 * Wer dadurch einen Mandanten verlöre, hat dort eine echte Rolle; das Skript
 * meldet es, bevor es etwas tut.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Änderungen.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-20-platform-admin-nur-im-eigenen-bereich.ts
 * Schreiblauf:
 *   pnpm tsx prisma/scripts/2026-09-20-platform-admin-nur-im-eigenen-bereich.ts --apply
 */

import { prisma } from "../seed-helpers.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(
    `\n🔐  platform_admin nur im eigenen Bereich — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`,
  );

  const rows = await prisma.userRoleAssignment.findMany({
    where: { role: "platform_admin" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      createdAt: true,
      tenant: { select: { name: true, kind: true } },
    },
  });
  console.log(`platform_admin-Zuweisungen gesamt: ${rows.length}`);

  // Der eigene Bereich je Nutzer: privat + dort `tenant_admin`.
  const eigene = await prisma.userRoleAssignment.findMany({
    where: { role: "tenant_admin", tenant: { kind: "personal" } },
    select: { userId: true, tenantId: true },
  });
  const eigenerBereich = new Map<string, string>();
  for (const e of eigene)
    if (!eigenerBereich.has(e.userId)) eigenerBereich.set(e.userId, e.tenantId);

  // Andere Rollen desselben Nutzers im selben Mandanten — bleibt er drin?
  const andere = await prisma.userRoleAssignment.findMany({
    where: { role: { not: "platform_admin" } },
    select: { userId: true, tenantId: true, role: true },
  });
  const bleibt = new Map<string, string[]>();
  for (const a of andere) {
    const k = `${a.userId}:${a.tenantId}`;
    bleibt.set(k, [...(bleibt.get(k) ?? []), a.role]);
  }

  // Je Inhaber genau ein Träger: der eigene Bereich, sonst die älteste Zeile.
  const traeger = new Map<string, string>();
  for (const r of rows) {
    if (eigenerBereich.get(r.userId) === r.tenantId) traeger.set(r.userId, r.id);
  }
  for (const r of rows) if (!traeger.has(r.userId)) traeger.set(r.userId, r.id);

  const zuLoeschen = rows.filter((r) => traeger.get(r.userId) !== r.id);

  console.log(`  Träger des Kennzeichens (bleiben): ${traeger.size}`);
  for (const r of rows.filter((x) => traeger.get(x.userId) === x.id)) {
    const eigen = eigenerBereich.get(r.userId) === r.tenantId;
    console.log(
      `    ${r.userId}  ${r.tenant.name} [${r.tenant.kind}]${eigen ? "  (eigener Bereich)" : "  ⚠ kein eigener Bereich — älteste Zeile bleibt"}`,
    );
  }
  console.log(`  werden entfernt: ${zuLoeschen.length}\n`);

  for (const r of zuLoeschen) {
    const rest = bleibt.get(`${r.userId}:${r.tenantId}`) ?? [];
    const hinweis = rest.length
      ? `behält dort: ${rest.join(", ")}`
      : "⚠ verliert den Zugang zu diesem Bereich";
    console.log(`  ${r.userId}  ${r.tenant.name} [${r.tenant.kind}]  → ${hinweis}`);
  }

  // Gegenprobe: niemand darf das Kennzeichen verlieren.
  const nachher = new Set(rows.filter((r) => !zuLoeschen.includes(r)).map((r) => r.userId));
  const verlieren = [...new Set(rows.map((r) => r.userId))].filter((u) => !nachher.has(u));
  if (verlieren.length > 0) {
    console.log(`\n⛔  Würden das Plattform-Kennzeichen verlieren: ${verlieren.join(", ")}`);
    console.log("    Abbruch — das ist ein Fehler in der Auswahl, keine gewollte Wirkung.");
    process.exitCode = 1;
    return;
  }

  // Bleibt jemand in einem Mandanten hängen, in dem er sonst nichts ist?
  const haengt = rows
    .filter((r) => traeger.get(r.userId) === r.id && eigenerBereich.get(r.userId) !== r.tenantId)
    .filter((r) => (bleibt.get(`${r.userId}:${r.tenantId}`) ?? []).length === 0);
  if (haengt.length > 0) {
    console.log("\n⚠  Träger-Zeile in einem Mandanten ohne weitere Rolle:");
    for (const r of haengt) console.log(`    ${r.userId}  ${r.tenant.name}`);
  }

  if (!APPLY) {
    console.log("\nTrockenlauf — nichts geschrieben. Mit --apply ausführen.\n");
    return;
  }
  const res = await prisma.userRoleAssignment.deleteMany({
    where: { id: { in: zuLoeschen.map((r) => r.id) } },
  });
  console.log(`\n✅  ${res.count} Zuweisungen entfernt.\n`);
}

void main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
