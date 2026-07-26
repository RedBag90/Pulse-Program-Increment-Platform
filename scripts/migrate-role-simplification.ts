/**
 * Einmalige Daten-Migration: Rollen-Vereinfachung 11 → 8.
 *
 *   transformation_lead → portfolio_manager
 *   vmo                 → portfolio_manager
 *   team_editor         → rte
 *
 * Migriert `UserRoleAssignment` (mit Scope-Merge bei Kollision) und
 * `RoleCapability` (Fold der tenant-individuellen Capability-Zeilen). Idempotent:
 * ein zweiter Lauf findet keine Alt-Rollen mehr und ist ein No-op.
 *
 * Ausführen (nach dem Code-Merge):
 *   set -a; source .env.local; set +a; export DATABASE_URL="$DIRECT_URL"
 *   npx tsx scripts/migrate-role-simplification.ts
 */

/* eslint-disable no-console -- one-off CLI migration; console output is the UX */
import { PrismaClient } from "@/generated/prisma";

const db = new PrismaClient();

const ROLE_MAP: Record<string, string> = {
  transformation_lead: "portfolio_manager",
  vmo: "portfolio_manager",
  team_editor: "rte",
};
const OLD_ROLES = Object.keys(ROLE_MAP);

/** Scope-Merge: leeres Array = „alle" gewinnt; sonst deduplizierte Union. */
function mergeScopes(a: string[], b: string[]): string[] {
  if (a.length === 0 || b.length === 0) return [];
  return [...new Set([...a, ...b])];
}

async function migrateAssignments(): Promise<void> {
  const rows = await db.userRoleAssignment.findMany({ where: { role: { in: OLD_ROLES } } });
  let renamed = 0;
  let merged = 0;
  for (const r of rows) {
    const target = ROLE_MAP[r.role]!;
    const existing = await db.userRoleAssignment.findFirst({
      where: { userId: r.userId, tenantId: r.tenantId, role: target },
    });
    if (existing) {
      await db.$transaction([
        db.userRoleAssignment.update({
          where: { id: existing.id },
          data: {
            valueStreamIds: mergeScopes(existing.valueStreamIds, r.valueStreamIds),
            artIds: mergeScopes(existing.artIds, r.artIds),
            teamIds: mergeScopes(existing.teamIds, r.teamIds),
          },
        }),
        db.userRoleAssignment.delete({ where: { id: r.id } }),
      ]);
      merged++;
    } else {
      await db.userRoleAssignment.update({ where: { id: r.id }, data: { role: target } });
      renamed++;
    }
  }
  console.log(
    `UserRoleAssignment: ${rows.length} Alt-Zeilen → ${renamed} umbenannt, ${merged} gemerged`,
  );
}

async function migrateCapabilities(): Promise<void> {
  const rows = await db.roleCapability.findMany({ where: { role: { in: OLD_ROLES } } });
  let renamed = 0;
  let dropped = 0;
  for (const c of rows) {
    const target = ROLE_MAP[c.role]!;
    const existing = await db.roleCapability.findFirst({
      where: { tenantId: c.tenantId, role: target, action: c.action },
    });
    if (existing) {
      // Ziel-Rolle hat die Action schon → Alt-Zeile verwerfen (Scope der
      // bestehenden Ziel-Zeile gewinnt). Die Action bleibt vorhanden.
      await db.roleCapability.delete({ where: { id: c.id } });
      dropped++;
    } else {
      await db.roleCapability.update({ where: { id: c.id }, data: { role: target } });
      renamed++;
    }
  }
  console.log(
    `RoleCapability: ${rows.length} Alt-Zeilen → ${renamed} umbenannt, ${dropped} verworfen`,
  );
}

async function main(): Promise<void> {
  console.log("Rollen-Vereinfachung: Migration startet …");
  await migrateAssignments();
  await migrateCapabilities();
  const leftoverA = await db.userRoleAssignment.count({ where: { role: { in: OLD_ROLES } } });
  const leftoverC = await db.roleCapability.count({ where: { role: { in: OLD_ROLES } } });
  console.log(
    `Verbleibende Alt-Rollen-Zeilen: Assignments=${leftoverA}, Capabilities=${leftoverC}`,
  );
  if (leftoverA !== 0 || leftoverC !== 0)
    throw new Error("Migration unvollständig — Alt-Rollen verblieben");
  console.log("✅ Migration abgeschlossen.");
}

main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : String(e));
    await db.$disconnect();
    process.exit(1);
  });
