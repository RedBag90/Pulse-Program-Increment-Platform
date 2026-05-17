/* eslint-disable no-console */
import { PrismaClient } from "../src/generated/prisma";

/**
 * One-off, non-destructive role remap — rewrites existing
 * `UserRoleAssignment.role` strings from the old role set to the new
 * SAFe-oriented set. Run once before re-seeding.
 *
 *   pnpm dlx dotenv-cli -e .env.local -- pnpm dlx tsx@latest scripts/remap-roles.ts
 */
const db = new PrismaClient();

/** Old role string → new SAFe role string. */
const REMAP: Record<string, string> = {
  portfolio_editor: "portfolio_manager",
  art_full_editor: "rte",
  feature_editor: "feature_owner",
  architect_viewer: "viewer",
  art_arch_viewer: "viewer",
  portfolio_viewer: "viewer",
};

(async () => {
  for (const [oldRole, newRole] of Object.entries(REMAP)) {
    const res = await db.userRoleAssignment.updateMany({
      where: { role: oldRole },
      data: { role: newRole },
    });
    if (res.count > 0) console.log(`  ${oldRole} → ${newRole}: ${res.count}`);
  }
  console.log("Role remap complete.");
  await db.$disconnect();
})();
