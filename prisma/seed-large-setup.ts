/* eslint-disable no-console */
/**
 * „Large Setup Corp" — der **Aufbau** von Large Test Corp ohne dessen Inhalte.
 *
 * Zweck: ein Mandant, in dem man mit echten Daten anfangen kann, aber unter
 * denselben Einstellungen wie im Lastdatensatz — dieselbe Ökonomie, dieselben
 * Guardrails, dieselbe Practice `artEpics`, dieselben acht Konten mit
 * denselben Rollen. Was in `seed-large.ts` an Vorhaben, Budget, Zielen und
 * Risiken darübergelegt wird, entsteht hier **nicht**.
 *
 * **Drin** (Konfiguration + Nutzer):
 *   Tenant-Ökonomie (Kostenneutralität, Budgetfenster, Kosten je Job-Size-Punkt,
 *   Guardrail-Ziele, Dashboard-Horizont) · Rollen + Default-Capabilities ·
 *   die acht @pulse.dev-Konten · PI-Standard (10 Wochen) · Issue-Nummernkreis ·
 *   Zielbild (TOM) mit `artEpics: true`.
 *
 * **Nicht drin** (Fachdaten): Wertströme, ARTs, Solutions, Zeitleiste und PIs,
 * Epics, Features, KPIs, Budgetrunden, Run-the-Business-Positionen, Ziele,
 * Risiken, Freigaberegeln.
 *
 * Eine Folge davon steht ausdrücklich hier: `vso@pulse.dev` trägt
 * `value_stream_owner` **ohne Wertstrom-Scope**, weil es keinen Wertstrom gibt,
 * an den er hängen könnte. Sobald einer angelegt ist, gehört der Scope in der
 * Rollenverwaltung nachgetragen — sonst greift die Rolle ins Leere.
 *
 * Eigener Tenant, uid-Namespace `uid("large-setup:…")`, Reset-then-insert
 * (`wipeDomainData`) — ein zweiter Lauf erzeugt denselben Stand.
 *
 * Run: `pnpm db:seed:large-setup`  (lädt `.env.local` selbst; braucht DIRECT_URL
 * + Supabase Service-Role)
 */

import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import { prisma, upsertAuthUser, assignRole, wipeDomainData, uid } from "./seed-helpers.js";

const DAY = 86_400_000;
const YEAR = new Date().getFullYear();
const TENANT_NAME = "Large Setup Corp";

/**
 * Derselbe Zehnjahres-Horizont wie im Lastdatensatz: Jahr 1 = YEAR-4, Jahr 10 =
 * YEAR+5. Nur der **Rand** wird hier gebraucht — das Dashboard-Ende und das
 * Zieldatum des TOM —, deshalb steht hier der letzte Zyklus statt aller zwanzig.
 */
const LAST_CYCLE_START = new Date(YEAR + 5, 6, 6);
const LAST_CYCLE_END = new Date(LAST_CYCLE_START.getTime() + 178 * DAY);

async function ensureTenant(): Promise<string> {
  const existing = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (existing) {
    console.log(`  ↳ ${TENANT_NAME} existiert`);
    return existing.id;
  }
  const t = await prisma.tenant.create({
    data: {
      id: uid("large-setup:tenant"),
      name: TENANT_NAME,
      region: "eu",
      kind: "organization",
    },
  });
  console.log(`  ✓ ${TENANT_NAME} angelegt`);
  return t.id;
}

async function main() {
  console.log(`\n🌱  LARGE-SETUP-Seed startet (${TENANT_NAME} — Aufbau ohne Inhalte)\n`);

  console.log("── Auth-User");
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
  const ADMIN = U.admin;

  console.log("\n── Tenant + Ökonomie");
  const tenantId = await ensureTenant();
  await wipeDomainData(tenantId);

  // Wortgleich zu `seed-large.ts`. `enabledModules: []` heißt nicht „nichts",
  // sondern „Standardsatz" — `enabledModulesOrDefault` legt ihn je Tenant-Art fest.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      enabledModules: [],
      costNeutralTarget: 500_000,
      dashboardHorizonEnd: LAST_CYCLE_END,
      budgetWindowSize: 4,
      defaultHypothesisEffort: 30_000,
      costPerJobSizePoint: 1_500,
      guardrailTargets: {
        horizon: { h3: 10, h2: 25, h1: 55, h0: 10 },
        capacity: { business: 65, enabler: 35 },
      },
    },
  });
  console.log("  ✓ Ökonomie + Guardrail-Ziele gesetzt");

  console.log("\n── Rollen + Capabilities");
  await assignRole(U.admin, tenantId, "platform_admin");
  await assignRole(U.admin, tenantId, "tenant_admin");
  await assignRole(U.portfolio, tenantId, "portfolio_manager");
  await assignRole(U.vmo, tenantId, "portfolio_manager");
  await assignRole(U.rte, tenantId, "rte");
  await assignRole(U.owner, tenantId, "epic_owner");
  await assignRole(U.owner, tenantId, "feature_owner");
  await assignRole(U.viewer, tenantId, "viewer");
  // Ohne Wertstrom-Scope — siehe Kopf dieser Datei.
  await assignRole(U.vso, tenantId, "value_stream_owner");
  await assignRole(U.fo, tenantId, "feature_owner");

  const capsList = enumerateDefaultCapabilities();
  await prisma.roleCapability.createMany({
    data: capsList.map((c) => ({
      tenantId,
      role: c.role,
      action: c.action,
      scope: c.scope,
      createdBy: ADMIN,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ 10 Rollenzuweisungen, ${capsList.length} Default-Capabilities`);

  console.log("\n── Kadenz + Nummernkreis");
  await prisma.piStandard.create({
    data: {
      id: uid("large-setup:pistd"),
      tenantId,
      name: "Standard 10-Wochen",
      anchorMonth: 1,
      anchorDay: 6,
      cadenceWeeks: 10,
      piCount: 8,
      createdBy: ADMIN,
    },
  });
  await prisma.issueSettings.create({
    data: { id: uid("large-setup:issuesettings"), tenantId, prefix: "R-", lastNumber: 0 },
  });
  console.log("  ✓ PI-Standard (10 Wochen, 8 PIs) + Issue-Präfix R-");

  console.log("\n── Zielbild");
  await prisma.targetOperatingModel.create({
    data: {
      id: uid("large-setup:tom"),
      tenantId,
      status: "active",
      template: "portfolio_safe",
      targetValueStreams: 3,
      targetArtsTotal: 6,
      targetTeamsTotal: 18,
      targetPiCadenceWeeks: 10,
      targetDate: LAST_CYCLE_START,
      // Practice `artEpics` an — wie im Lastdatensatz. Ohne sie gäbe es keine
      // Klassifikation, kein ART-Epic-Budget und keine Verteilfläche.
      artEpics: true,
      createdBy: ADMIN,
      updatedBy: ADMIN,
    },
  });
  console.log("  ✓ TOM (3 Wertströme / 6 ARTs / 18 Teams angestrebt), Practice artEpics an");

  console.log(
    `\n✅ ${TENANT_NAME} steht: Einstellungen, Rollen und acht Konten — keine Fachdaten.` +
      `\n   Erster Schritt in der App: Wertströme und ARTs anlegen; danach den` +
      `\n   Wertstrom-Scope für vso@pulse.dev nachtragen.\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
