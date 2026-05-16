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
      impediments,
      dependencies,
      pi_objectives,
      sprints,
      initiatives,
      program_increments,
      teams,
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
