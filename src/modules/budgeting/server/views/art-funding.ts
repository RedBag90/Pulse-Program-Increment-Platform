/**
 * Die Fakten für den Leitfaden — einmal geladen, von beiden Detailflächen
 * benutzt.
 *
 * Alles hier wird auf den Flächen ohnehin gebraucht; die Funktion bündelt es
 * nur, damit die Leiste nicht auf jeder Seite neu zusammengesammelt wird.
 *
 * Die Fakten des Leitfadens — zwei Flächen rendern daraus; der Falter (`artFundingPhases`) wohnt in der Domäne. Der Ordner `views/` trägt, woraus eine Seite
 * rendert — nicht nur Dateien, die Lader **und** Falter selbst enthalten.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import {
  artFundingPhases,
  type FundingPhase,
  type FundingPhaseFacts,
} from "@/modules/budgeting/domain/art-funding-phases";
import { loadArtEpicBudgets } from "@/modules/budgeting/server/services/art-epic-budget";

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

  const [candidate, awards, budgets] = await Promise.all([
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
    // Zwei Abfragen für alle ARTs des Wertstroms — vorher zwei **je** ART.
    loadArtEpicBudgets(
      db,
      tenantId,
      arts.map((a) => a.id),
      cycleKey,
    ),
  ]);

  const totals = arts.map((a) => {
    const b = budgets.get(a.id);
    return { artId: a.id, total: b?.total ?? 0, distributed: b?.distributed ?? 0 };
  });

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
