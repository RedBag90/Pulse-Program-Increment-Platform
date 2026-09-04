/**
 * Die Fakten für den Leitfaden — einmal geladen, von beiden Detailflächen
 * benutzt.
 *
 * Alles hier wird auf den Flächen ohnehin gebraucht; die Funktion bündelt es
 * nur, damit die Leiste nicht auf jeder Seite neu zusammengesammelt wird.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  artFundingPhases,
  type FundingPhase,
  type FundingPhaseFacts,
} from "@/modules/budgeting/domain/art-funding-phases";
import { artEpicBudgetTotal } from "@/modules/budgeting/server/services/art-pot";

export async function loadFundingPhases(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  cycleKey: string,
  focusArtId?: string | undefined,
): Promise<FundingPhase[]> {
  const [items, round, arts] = await Promise.all([
    db.runTheBusinessItem.findMany({
      where: { tenantId, valueStreamId, kind: "art_change", active: true },
      select: { id: true, artId: true },
    }),
    db.budgetRound.findFirst({
      where: { tenantId, cycleKey },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
    db.art.findMany({ where: { tenantId, valueStreamId }, select: { id: true } }),
  ]);

  const [candidate, awards, allocations] = await Promise.all([
    round == null
      ? Promise.resolve(null)
      : db.budgetCandidate.findFirst({
          where: { tenantId, kind: "rtb", valueStreamId, roundId: round.id },
          select: { finalAmount: true },
        }),
    items.length === 0
      ? Promise.resolve([])
      : db.rtbItemAward.findMany({
          where: { tenantId, cycleKey, rtbItemId: { in: items.map((i) => i.id) } },
          select: { rtbItemId: true, amount: true },
        }),
    db.artEpicAllocation.findMany({
      where: { tenantId, cycleKey, artId: { in: arts.map((a) => a.id) } },
      select: { artId: true, amount: true },
    }),
  ]);

  const distributed = new Map<string, number>();
  for (const a of allocations) {
    distributed.set(a.artId, (distributed.get(a.artId) ?? 0) + Number(a.amount));
  }
  const totals = await Promise.all(
    arts.map(async (a) => ({
      artId: a.id,
      total: await artEpicBudgetTotal(db, tenantId, a.id, cycleKey),
      distributed: distributed.get(a.id) ?? 0,
    })),
  );

  const facts: FundingPhaseFacts = {
    valueStreamId,
    cycleKey,
    hasBudgetItem: items.length > 0,
    roundId: round?.id ?? null,
    // Die Positionen werden beim Start der Runde als eine Zeile je Wertstrom
    // materialisiert — der Kandidat ist der Beleg, dass sie darauf stehen.
    onPbList: candidate != null,
    awarded: candidate?.finalAmount != null,
    splitDone: awards.length > 0,
    arts: totals,
    ...(focusArtId != null ? { focusArtId } : {}),
  };
  return artFundingPhases(facts);
}
