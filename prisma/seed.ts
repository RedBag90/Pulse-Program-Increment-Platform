/* eslint-disable no-console */
/**
 * Pulse Minimal Seed — Auth-Users + Tenant + Rollen, sonst nichts.
 *
 * Zweck: leere Datenbank, in der man sich einloggen und mit echten Daten
 * arbeiten kann. Wischt alle Domain-Daten aus dem Demo-Tenant; Auth-
 * Accounts, der Tenant selbst und Role-Assignments bleiben (idempotent).
 *
 * Test-User (Passwort `Test1234!` ausser admin = `Admin1234!`):
 *   admin@pulse.dev          → tenant_admin
 *   portfolio@pulse.dev      → portfolio_manager
 *   vmo@pulse.dev            → portfolio_manager (VMO in PM zusammengelegt)
 *   rte@pulse.dev            → rte (Feature-QS)
 *   owner@pulse.dev          → epic_owner + feature_owner
 *   viewer@pulse.dev         → viewer
 *   transformation@pulse.dev → portfolio_manager (Transformation Lead in PM zusammengelegt)
 *
 * Run: `pnpm db:seed`  ·  Umfassendes Demo-Seed: `pnpm db:seed:demo`
 */

import {
  prisma,
  ensureTenant,
  upsertAuthUser,
  assignRole,
  wipeDomainData,
} from "./seed-helpers.js";

async function main() {
  console.log("\n🌱  Pulse Minimal-Seed startet\n");

  console.log("── Auth-User");
  const adminId = await upsertAuthUser("admin@pulse.dev", "Admin1234!");
  const portfolioId = await upsertAuthUser("portfolio@pulse.dev", "Test1234!");
  const vmoId = await upsertAuthUser("vmo@pulse.dev", "Test1234!");
  const rteId = await upsertAuthUser("rte@pulse.dev", "Test1234!");
  const ownerId = await upsertAuthUser("owner@pulse.dev", "Test1234!");
  const viewerId = await upsertAuthUser("viewer@pulse.dev", "Test1234!");
  const transformationLeadId = await upsertAuthUser("transformation@pulse.dev", "Test1234!");

  console.log("\n── Tenant");
  const tenantId = await ensureTenant();

  await wipeDomainData(tenantId);

  console.log("\n── Role-Assignments");
  await assignRole(adminId, tenantId, "tenant_admin");
  await assignRole(portfolioId, tenantId, "portfolio_manager");
  // VMO + Transformation Lead sind in portfolio_manager zusammengelegt.
  await assignRole(vmoId, tenantId, "portfolio_manager");
  await assignRole(rteId, tenantId, "rte");
  await assignRole(ownerId, tenantId, "epic_owner");
  await assignRole(ownerId, tenantId, "feature_owner");
  await assignRole(viewerId, tenantId, "viewer");
  await assignRole(transformationLeadId, tenantId, "portfolio_manager");
  console.log("  ✓ Rollen zugewiesen");

  console.log("\n✅ Minimal-Seed fertig. DB enthält nur Tenant + User + Rollen.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
