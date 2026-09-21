/* eslint-disable no-console */
/**
 * **Was sich beim Testen angesammelt hat — vorschlagen, nicht entscheiden.**
 *
 * Drei Gruppen, jede einzeln zuschaltbar, jede mit einer Sperre:
 *
 *  1. **Leere private Bereiche.** Jeder Nutzer bekommt beim ersten `/start`
 *     einen (`ensurePersonalTenant`); gemessen am 2026-09-21 waren das 23, davon
 *     21 vollstaendig leer. Geloescht wird nur, was **null** Ziele, Themes,
 *     Vorhaben und KPIs traegt.
 *  2. **Kontenlose Zuweisungen.** `UserRoleAssignment.userId` traegt keinen
 *     Fremdschluessel nach Supabase — geloeschte Konten lassen Zeilen zurueck.
 *  3. **Verwaiste Konten**, und hier nur `@pulse.dev`.
 *
 * **Warum die Sperren nicht Vorsicht sind, sondern Erfahrung:** eine erste
 * Zaehlung in derselben Sitzung meldete „23 leere Bereiche", weil sie nur
 * Initiativen zaehlte. Private Bereiche tragen aber das **Ziele**-Modul —
 * „Mein Bereich (philipp.koch.hh)" hielt 35 Ziele, 1 Theme und 303
 * Audit-Ereignisse. Ein Lauf nach dieser Zaehlung haette einen echten
 * Arbeitsbereich mitgenommen.
 *
 * Aus demselben Grund bleiben **echte E-Mail-Adressen** stehen: von sieben
 * kontenlosen Nutzern waren vier `@pulse.dev`-Testkonten und drei richtige
 * Adressen. Der Lauf listet sie und ruehrt sie nicht an.
 *
 * Trockenlauf (Voreinstellung):
 *   pnpm tsx prisma/scripts/2026-09-21-test-ballast-aufraeumen.ts
 * Schreiblauf, Gruppen einzeln:
 *   … --apply --bereiche --zuweisungen --konten
 */

import { prisma, supabaseAdmin } from "../seed-helpers.js";
import { wipeTenantData, TEARDOWN_TX_OPTIONS } from "@/server/services/tenant-teardown";

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const TU = {
  bereiche: ARGS.includes("--bereiche"),
  zuweisungen: ARGS.includes("--zuweisungen"),
  konten: ARGS.includes("--konten"),
};

/** Nur diese Domäne darf der Lauf löschen. Alles andere ist ein echter Mensch. */
const TEST_DOMAIN = "@pulse.dev";

async function alleAuthNutzer(): Promise<Map<string, string>> {
  const nach = new Map<string, string>();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) nach.set(u.id, u.email ?? "");
    if (data.users.length < 200) break;
  }
  return nach;
}

async function main() {
  console.log(`\n🧹  Test-Ballast — ${APPLY ? "SCHREIBLAUF" : "Trockenlauf"}\n`);
  if (APPLY && !TU.bereiche && !TU.zuweisungen && !TU.konten) {
    console.log("⛔  --apply ohne Gruppe. Eine von --bereiche --zuweisungen --konten waehlen.\n");
    process.exit(1);
  }

  const authNutzer = await alleAuthNutzer();
  console.log(`Auth-Konten: ${authNutzer.size}`);

  // ── 1 · Leere private Bereiche ────────────────────────────────────────────
  const privat = await prisma.tenant.findMany({
    where: { kind: "personal" },
    select: {
      id: true,
      name: true,
      _count: {
        select: { objectives: true, strategicThemes: true, initiatives: true, kpis: true },
      },
    },
    orderBy: { name: "asc" },
  });
  const inhalt = (t: (typeof privat)[number]) =>
    t._count.objectives + t._count.strategicThemes + t._count.initiatives + t._count.kpis;
  const leer = privat.filter((t) => inhalt(t) === 0);
  const voll = privat.filter((t) => inhalt(t) > 0);

  console.log(`\n── Private Bereiche: ${privat.length}, davon leer: ${leer.length}`);
  for (const t of voll) {
    console.log(
      `  ⛔ ${t.name} — ${t._count.objectives} Ziele, ${t._count.strategicThemes} Themes, ` +
        `${t._count.initiatives} Vorhaben, ${t._count.kpis} KPIs — bleibt`,
    );
  }
  console.log(`  ${leer.length} leere Bereiche zum Loeschen`);

  // ── 2 · Kontenlose Zuweisungen ────────────────────────────────────────────
  const zuweisungen = await prisma.userRoleAssignment.findMany({
    select: { id: true, userId: true, tenantId: true, role: true },
  });
  const kontenlos = zuweisungen.filter((z) => !authNutzer.has(z.userId));
  console.log(`\n── Zuweisungen ohne Konto: ${kontenlos.length} von ${zuweisungen.length}`);

  // ── 3 · Verwaiste Konten ──────────────────────────────────────────────────
  const mitZuweisung = new Set(zuweisungen.map((z) => z.userId));
  const verwaist = [...authNutzer.entries()].filter(([id]) => !mitZuweisung.has(id));
  const testkonten = verwaist.filter(([, email]) => email.endsWith(TEST_DOMAIN));
  const echte = verwaist.filter(([, email]) => !email.endsWith(TEST_DOMAIN));

  console.log(`\n── Konten ohne Zuweisung: ${verwaist.length}`);
  for (const [, email] of testkonten) console.log(`  → ${email}`);
  for (const [, email] of echte) console.log(`  ⛔ ${email} — keine Testadresse, bleibt`);

  if (!APPLY) {
    console.log(`\nTrockenlauf — nichts geschrieben.`);
    console.log(`Mit --apply und einer Gruppe: --bereiche --zuweisungen --konten\n`);
    return;
  }

  if (TU.bereiche) {
    let n = 0;
    for (const t of leer) {
      // Auch ein „leerer" Bereich traegt Audit, Capabilities und Zuweisungen.
      await prisma.$transaction(async (tx) => {
        await wipeTenantData(tx, t.id, { includeMembers: true });
        await tx.tenant.delete({ where: { id: t.id } });
      }, TEARDOWN_TX_OPTIONS);
      n++;
    }
    console.log(`\n✅  ${n} leere private Bereiche geloescht.`);
  }

  if (TU.zuweisungen && kontenlos.length > 0) {
    const res = await prisma.userRoleAssignment.deleteMany({
      where: { id: { in: kontenlos.map((z) => z.id) } },
    });
    console.log(`✅  ${res.count} kontenlose Zuweisungen geloescht.`);
  }

  if (TU.konten) {
    let n = 0;
    for (const [id, email] of testkonten) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) console.log(`  ⚠ ${email}: ${error.message}`);
      else n++;
    }
    console.log(`✅  ${n} verwaiste Testkonten geloescht.`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
