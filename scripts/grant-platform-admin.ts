/**
 * Vergibt die globale `platform_admin`-Rolle an einen User (idempotent).
 *
 * Die Rolle liegt im **Personal-Tenant** des Users (isPlatformAdmin ist
 * tenant-blind — s. `getPrincipal`). Der User muss sich mindestens einmal
 * eingeloggt haben, damit sein Personal-Tenant existiert (Lazy-Ensure in
 * `/start`). Ein zweiter Lauf findet das Assignment bereits vor → No-op.
 *
 * Ausführen:
 *   set -a; source .env.local; set +a; export DATABASE_URL="$DIRECT_URL"
 *   npx tsx scripts/grant-platform-admin.ts user@example.com
 *   # ohne Argument: Fallback auf $PLATFORM_ADMIN_EMAIL
 */

/* eslint-disable no-console -- one-off CLI script; console output is the UX */
import { PrismaClient } from "@/generated/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/modules/core/kernel/domain/roles";

const db = new PrismaClient();

/** Sucht die Supabase-User-Id zu einer E-Mail (paginierte admin.listUsers). */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.PLATFORM_ADMIN_EMAIL ?? "").trim();
  if (!email) {
    console.error("Keine E-Mail. Aufruf: npx tsx scripts/grant-platform-admin.ts <email>");
    process.exit(1);
  }

  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error(`Kein Supabase-User mit E-Mail ${email} gefunden.`);
    process.exit(1);
  }

  const existing = await db.userRoleAssignment.findFirst({
    where: { userId, role: ROLES.PLATFORM_ADMIN },
    select: { id: true },
  });
  if (existing) {
    console.log(`✓ ${email} ist bereits platform_admin — No-op.`);
    return;
  }

  const personal = await db.tenant.findFirst({
    where: { kind: "personal", userRoleAssignments: { some: { userId } } },
    select: { id: true },
  });
  if (!personal) {
    console.error(
      `Kein Personal-Tenant für ${email}. Der User muss sich einmal einloggen (/start legt ihn an).`,
    );
    process.exit(1);
  }

  await db.userRoleAssignment.create({
    data: {
      userId,
      tenantId: personal.id,
      role: ROLES.PLATFORM_ADMIN,
      valueStreamIds: [],
      artIds: [],
      teamIds: [],
    },
  });
  console.log(`✓ ${email} → platform_admin (Personal-Tenant ${personal.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
