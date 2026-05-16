import { PrismaClient } from "@/generated/prisma";

/**
 * A plain PrismaClient that bypasses RLS extensions.
 * Only for use in test setup/teardown — never in application code.
 */
export function createTestPrismaClient(): PrismaClient {
  const url = process.env["DATABASE_URL_TEST"];
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set — cannot create test database client");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}
