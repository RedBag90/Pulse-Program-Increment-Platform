/* eslint-disable no-console */
/**
 * Seeds one test account per RBAC role into the demo tenant — idempotent.
 *
 *   node --env-file=.env.local scripts/seed-test-accounts.mjs
 *
 * Every account uses the password below. Each is assigned exactly one role
 * with empty visibility scopes (= "all in scope"), so it sees everything its
 * role permits.
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/index.js";

const PASSWORD = "Test1234!";

/** email → role. Order mirrors docs/personas.md. */
const ROLE_ACCOUNTS = [
  { email: "platform-admin@pulse.dev", role: "platform_admin" },
  { email: "tenant-admin@pulse.dev", role: "tenant_admin" },
  { email: "portfolio-manager@pulse.dev", role: "portfolio_manager" },
  { email: "value-stream-owner@pulse.dev", role: "value_stream_owner" },
  { email: "epic-owner@pulse.dev", role: "epic_owner" },
  { email: "vmo@pulse.dev", role: "vmo" },
  { email: "rte@pulse.dev", role: "rte" },
  { email: "feature-owner@pulse.dev", role: "feature_owner" },
  { email: "team-editor@pulse.dev", role: "team_editor" },
  { email: "story-owner@pulse.dev", role: "story_owner" },
  { email: "task-owner@pulse.dev", role: "task_owner" },
  { email: "viewer@pulse.dev", role: "viewer" },
];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

/** Returns the auth user id for `email`, creating the user if absent. */
async function upsertAuthUser(email) {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ↳ exists: ${email}`);
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
  console.log(`  ✓ created: ${email}`);
  return data.user.id;
}

async function main() {
  console.log("\n🌱  Seeding per-role test accounts…\n");

  const tenant =
    (await prisma.tenant.findFirst({ where: { name: "Pulse Demo Corp" } })) ??
    (await prisma.tenant.findFirst());
  if (!tenant) throw new Error("No tenant found — run the main seed first.");
  console.log(`Tenant: ${tenant.name} (${tenant.id})\n`);

  for (const { email, role } of ROLE_ACCOUNTS) {
    const userId = await upsertAuthUser(email);
    await prisma.userRoleAssignment.upsert({
      where: { userId_tenantId_role: { userId, tenantId: tenant.id, role } },
      create: { userId, tenantId: tenant.id, role, valueStreamIds: [], artIds: [], teamIds: [] },
      update: {},
    });
    console.log(`  → role: ${role}`);
  }

  console.log(`\n✅  ${ROLE_ACCOUNTS.length} accounts ready. Password for all: ${PASSWORD}\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
