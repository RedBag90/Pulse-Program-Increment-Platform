/**
 * **Schreibende Seed-Bausteine, die ihren Client mitgebracht bekommen.**
 *
 * Abgespalten aus `seed-helpers.ts` aus demselben Grund wie `seed-ids.ts`: die
 * Datei dort laedt beim Import `.env.local` und baut einen eigenen Client. Was
 * ein Seeder braucht, darf das nicht voraussetzen.
 */

import type { PrismaClient, Prisma } from "../src/generated/prisma/index.js";

export interface RoleScopes {
  valueStreamIds?: string[];
  artIds?: string[];
  teamIds?: string[];
}

/** Rollen-Zuweisung (idempotent) mit optionalen Scopes. */
export function assignRoleIn(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  tenantId: string,
  role: string,
  scopes: RoleScopes = {},
) {
  const data = {
    valueStreamIds: scopes.valueStreamIds ?? [],
    artIds: scopes.artIds ?? [],
    teamIds: scopes.teamIds ?? [],
  };
  return db.userRoleAssignment.upsert({
    where: { userId_tenantId_role: { userId, tenantId, role } },
    create: { userId, tenantId, role, ...data },
    update: data,
  });
}
