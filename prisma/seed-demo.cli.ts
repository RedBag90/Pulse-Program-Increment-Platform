/* eslint-disable no-console */
/**
 * **Kommandozeile fuer `pnpm db:seed:demo`.**
 *
 * Abgespalten im September 2026. Der Datensatz selbst steht in `seed-demo.ts`
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

import {
  prisma as cliDb,
  ensureTenant,
  upsertAuthUser,
  wipeDomainData,
  uidFor,
} from "./seed-helpers.js";
import { fillSeedUsers } from "./seed-context.js";
import { seedDense } from "./seed-demo.js";

// ---------------------------------------------------------------------------
// Kommandozeile — `pnpm db:seed:demo`
// ---------------------------------------------------------------------------

/**
 * Besorgt Konten und Mandant und ruft den Seeder fuer „Pulse Demo Corp" auf.
 * **Namensraum `""`** — damit bleiben die Ids exakt die bisherigen und ein
 * zweiter Lauf ersetzt, statt zu verdoppeln (`seed-ids.ts`).
 */
async function main() {
  console.log("\n🌱  Pulse DEMO-Seed startet (dichter Story-Datensatz)\n");

  console.log("── Auth-User");
  const U = {
    admin: await upsertAuthUser("admin@pulse.dev", "Admin1234!"),
    portfolio: await upsertAuthUser("portfolio@pulse.dev", "Test1234!"),
    vmo: await upsertAuthUser("vmo@pulse.dev", "Test1234!"),
    rte: await upsertAuthUser("rte@pulse.dev", "Test1234!"),
    owner: await upsertAuthUser("owner@pulse.dev", "Test1234!"),
    viewer: await upsertAuthUser("viewer@pulse.dev", "Test1234!"),
    transformation: await upsertAuthUser("transformation@pulse.dev", "Test1234!"),
    vso: await upsertAuthUser("vso@pulse.dev", "Test1234!"),
    fo: await upsertAuthUser("fo@pulse.dev", "Test1234!"),
  };

  console.log("\n── Tenant");
  const tenantId = await ensureTenant();
  await wipeDomainData(tenantId);

  await seedDense({
    db: cliDb,
    tenantId,
    uid: uidFor(""),
    users: fillSeedUsers(U, U.admin),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => cliDb.$disconnect());
