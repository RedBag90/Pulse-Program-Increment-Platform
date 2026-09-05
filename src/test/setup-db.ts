import { beforeAll, afterEach, afterAll } from "vitest";
import { createTestPrismaClient } from "@/server/db/test-client";
import type { PrismaClient } from "@/generated/prisma";

let db: PrismaClient;

beforeAll(async () => {
  if (!process.env["DATABASE_URL_TEST"]) {
    throw new Error(
      "Integration tests require DATABASE_URL_TEST.\n" +
        "Run `supabase start` then set DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:54322/postgres",
    );
  }
  db = createTestPrismaClient();
  await db.$connect();
});

afterEach(async () => {
  // Truncate in reverse FK order to reset state between tests
  await db.$executeRawUnsafe(`
    TRUNCATE
      outbox_events,
      idempotency_keys,
      audit_events,
      -- Budgeting. Fehlten hier bis September 2026 vollstaendig: die Zeilen
      -- wurden nur mittelbar ueber CASCADE von tenants/initiatives erwischt,
      -- was zwischen zwei Tests Reste stehen liess, sobald einer davon einen
      -- Mandanten wiederverwendete.
      art_epic_allocations,
      rtb_item_awards,
      run_the_business_items,
      budget_decisions,
      budget_candidates,
      budget_group_members,
      budget_groups,
      budget_participants,
      budget_rounds,
      budget_plan_revisions,
      budget_allocations,
      impediments,
      dependencies,
      stage_gate_approvals,
      stage_gate_transitions,
      stage_gate_approver_rules,
      initiatives,
      program_increments,
      arts,
      value_streams,
      user_role_assignments,
      tenants
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await db?.$disconnect();
});

export { db };
