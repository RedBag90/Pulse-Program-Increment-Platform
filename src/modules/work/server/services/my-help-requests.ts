import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";

/**
 * „I need help" — die Empfänger-Sicht. Ein Epic-Owner setzt am Epic die Bitte um
 * Unterstützung (`helpRequestedAt`); hier holen wir für den Betrachter die offenen
 * Bitten, die IHN etwas angehen:
 *
 *  - Portfolio-Manager (Rolle `portfolio_manager`) sehen alle offenen Bitten im
 *    Tenant — sie sind der konsolidierte Portfolio-Lead.
 *  - Sonst sieht man nur die Epics der Wertströme, deren VMO man ist
 *    (`ValueStream.vmoId === userId`).
 *
 * Sibling zu `listMyTasks` (Ownership) und `listMyApprovals` (Entscheidungen):
 * das hier sind Hinweise, die aus einer fremden Owner-Aktion für mich entstehen.
 * Rein lesend.
 */
export interface HelpRequestTask {
  epicId: string;
  title: string;
  ownerId: string | null;
  valueStreamName: string | null;
  requestedAtMs: number;
}

export async function listMyHelpRequests(
  db: PrismaClient,
  principal: { id: string; tenantId: string; roles: string[] },
): Promise<HelpRequestTask[]> {
  const { id: userId, tenantId, roles } = principal;
  const isPortfolioManager = roles.includes("portfolio_manager");

  const rows = await db.initiative.findMany({
    where: {
      tenantId,
      deletedAt: null,
      level: InitiativeLevel.EPIC,
      helpRequestedAt: { not: null },
      ...(isPortfolioManager ? {} : { valueStream: { vmoId: userId } }),
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      helpRequestedAt: true,
      valueStream: { select: { name: true } },
    },
    orderBy: { helpRequestedAt: "desc" },
  });

  return rows.map((r) => ({
    epicId: r.id,
    title: r.title,
    ownerId: r.ownerId,
    valueStreamName: r.valueStream?.name ?? null,
    // `helpRequestedAt` ist im `where` als `not: null` garantiert.
    requestedAtMs: r.helpRequestedAt!.getTime(),
  }));
}
