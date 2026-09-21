/* eslint-disable no-console */
/**
 * **Kommandozeile fuer `pnpm db:seed:large-setup`.**
 *
 * Abgespalten im September 2026. Der Datensatz selbst steht in `seed-large-setup.ts`
 * und darf **nichts** aus `seed-helpers.ts` beruehren: die Datei baut beim
 * Import einen eigenen Prisma-Client auf `DIRECT_URL` und den Supabase-Client
 * mit dem Service-Role-Schluessel. Solange der Seeder sie mitzog, konnte die
 * Plattform-Verwaltung ihn nicht importieren, ohne beides in den Server-Build zu
 * ziehen.
 *
 * Hier ist das in Ordnung — diese Datei laeuft nur als Skript.
 *
 * **Namensraum `""`**: die Ids bleiben damit exakt die bisherigen, ein zweiter
 * Lauf ersetzt statt zu verdoppeln (`seed-ids.ts`).
 */

import { prisma as cliDb, upsertAuthUser, wipeDomainData, uidFor } from "./seed-helpers.js";
import { fillSeedUsers } from "./seed-context.js";
import { seedSkeleton, TENANT_NAME } from "./seed-large-setup.js";

// ---------------------------------------------------------------------------
// Kommandozeile — `pnpm db:seed:large-setup`
// ---------------------------------------------------------------------------

/**
 * Besorgt, was der Seeder braucht, und ruft ihn fuer den angestammten Mandanten
 * auf. **Namensraum `""`** — die Ids bleiben damit exakt die bisherigen; ein
 * zweiter Lauf ersetzt, statt zu verdoppeln (`seed-ids.ts`).
 */
async function main() {
  console.log(`\n🌱  LARGE-SETUP-Seed startet (${TENANT_NAME} — Aufbau ohne Inhalte)\n`);

  console.log("── Auth-User");
  const uid = uidFor("");
  const U = {
    admin: await upsertAuthUser("admin@pulse.dev", "Admin1234!"),
    portfolio: await upsertAuthUser("portfolio@pulse.dev", "Test1234!"),
    vmo: await upsertAuthUser("vmo@pulse.dev", "Test1234!"),
    rte: await upsertAuthUser("rte@pulse.dev", "Test1234!"),
    owner: await upsertAuthUser("owner@pulse.dev", "Test1234!"),
    viewer: await upsertAuthUser("viewer@pulse.dev", "Test1234!"),
    vso: await upsertAuthUser("vso@pulse.dev", "Test1234!"),
    fo: await upsertAuthUser("fo@pulse.dev", "Test1234!"),
  };

  console.log("\n── Tenant + Ökonomie");
  const existing = await cliDb.tenant.findFirst({ where: { name: TENANT_NAME } });
  const tenantId =
    existing?.id ??
    (
      await cliDb.tenant.create({
        data: {
          id: uid("large-setup:tenant"),
          name: TENANT_NAME,
          region: "eu",
          kind: "organization",
        },
      })
    ).id;
  console.log(`  ${existing ? "↳" : "✓"} ${TENANT_NAME} ${existing ? "existiert" : "angelegt"}`);
  await wipeDomainData(tenantId);

  await seedSkeleton({
    db: cliDb,
    tenantId,
    uid,
    users: fillSeedUsers(U, U.admin),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => cliDb.$disconnect());
