import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/**
 * Der Personenpool des Mandanten mit seinen Rollen — die Quelle jeder
 * Personenauswahl: Epic-Owner benennen, Abnehmer eines Reifegrad-Antrags
 * besetzen, Wertstrom-Governance pflegen.
 *
 * Stand früher in `epic-approval.ts` und ist mit dessen Rückbau hierher
 * gewandert: mit der abgeschafften Mehrparteien-Achse hat die Liste nichts zu
 * tun, sie zählt schlicht auf, wen es im Mandanten gibt.
 */
export async function listTenantApprovers(db: PrismaClient, tenantId: TenantId) {
  const assignments = await db.userRoleAssignment.findMany({
    where: { tenantId },
    select: { userId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const byUser = new Map<string, string[]>();
  for (const a of assignments) {
    (byUser.get(a.userId) ?? byUser.set(a.userId, []).get(a.userId)!).push(a.role);
  }
  return [...byUser.entries()].map(([userId, roles]) => ({ userId, roles }));
}
