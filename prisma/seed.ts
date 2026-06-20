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
 *   vmo@pulse.dev            → vmo (Epic-QS)
 *   rte@pulse.dev            → rte (Feature-QS)
 *   owner@pulse.dev          → epic_owner + feature_owner
 *   viewer@pulse.dev         → viewer
 *   transformation@pulse.dev → transformation_lead
 *
 * Run: `pnpm db:seed`
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/index.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DIRECT_URL!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TENANT_NAME = "Pulse Demo Corp";

async function upsertAuthUser(email: string, password: string): Promise<string> {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);
  if (found) {
    console.log(`  ↳ ${email}`);
    return found.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user) throw error ?? new Error(`Failed to create ${email}`);
  console.log(`  ✓ ${email}`);
  return data.user.id;
}

async function wipeDomainData(tenantId: string): Promise<void> {
  console.log("\n── Wiping domain data (tenant + auth + roles bleiben)");

  // Ziele V2 (Theme = Objective; Vision/Strategic-Theme als Datenmodell-Anker)
  await prisma.krKpiContribution.deleteMany({ where: { tenantId } });
  await prisma.keyResult.deleteMany({ where: { tenantId } });
  await prisma.themeEpicLink.deleteMany({ where: { tenantId } });
  await prisma.objective.deleteMany({ where: { tenantId } });
  await prisma.strategicTheme.deleteMany({ where: { tenantId } });
  await prisma.portfolioVision.deleteMany({ where: { tenantId } });

  // Legacy transformation
  await prisma.goalEpicLink.deleteMany({ where: { tenantId } });
  await prisma.targetOutcome.deleteMany({ where: { tenantId } });
  await prisma.transformationGoal.deleteMany({ where: { tenantId } });
  await prisma.transformationAction.deleteMany({ where: { tenantId } });
  await prisma.transformationSnapshot.deleteMany({ where: { tenantId } });
  await prisma.targetOperatingModel.deleteMany({ where: { tenantId } });

  // Budgeting
  await prisma.budgetPlanRevision.deleteMany({ where: { tenantId } });
  await prisma.artBudget.deleteMany({ where: { tenantId } });
  await prisma.budgetAllocation.deleteMany({ where: { tenantId } });

  // Initiative side-tables
  await prisma.epicApproval.deleteMany({ where: { tenantId } });
  await prisma.kpi.deleteMany({ where: { tenantId } });
  await prisma.dependency.deleteMany({ where: { tenantId } });

  // Initiatives leaf-first (Feature bevor Epic)
  await prisma.initiative.deleteMany({ where: { tenantId, level: 1 } });
  await prisma.initiative.deleteMany({ where: { tenantId, level: 0 } });

  // PI-scoped
  await prisma.piObjective.deleteMany({ where: { tenantId } });
  await prisma.impediment.deleteMany({ where: { tenantId } });
  await prisma.systemDemo.deleteMany({ where: { tenantId } });
  await prisma.programIncrement.deleteMany({ where: { tenantId } });

  // Org-Struktur
  await prisma.team.deleteMany({ where: { tenantId } });
  await prisma.art.deleteMany({ where: { tenantId } });
  await prisma.timeline.deleteMany({ where: { tenantId } });
  await prisma.valueStream.deleteMany({ where: { tenantId } });

  // Standalone
  await prisma.piStandard.deleteMany({ where: { tenantId } });

  console.log("  ✓ Domain-Daten geloescht");
}

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
  let tenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { id: TENANT_ID, name: TENANT_NAME, region: "eu" },
    });
    console.log(`  ✓ ${TENANT_NAME} angelegt`);
  } else {
    console.log(`  ↳ ${TENANT_NAME} existiert`);
  }
  const tenantId = tenant.id;

  await wipeDomainData(tenantId);

  console.log("\n── Role-Assignments");
  const assignRole = (userId: string, role: string) =>
    prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId, tenantId, role } },
      create: { userId, tenantId, role, valueStreamIds: [], artIds: [], teamIds: [] },
      update: { valueStreamIds: [], artIds: [], teamIds: [] },
    });

  await assignRole(adminId, "tenant_admin");
  await assignRole(portfolioId, "portfolio_manager");
  await assignRole(vmoId, "vmo");
  await assignRole(rteId, "rte");
  await assignRole(ownerId, "epic_owner");
  await assignRole(ownerId, "feature_owner");
  await assignRole(viewerId, "viewer");
  await assignRole(transformationLeadId, "transformation_lead");
  console.log("  ✓ 8 Rollen zugewiesen");

  console.log("\n✅ Minimal-Seed fertig. DB enthält nur Tenant + User + Rollen.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
