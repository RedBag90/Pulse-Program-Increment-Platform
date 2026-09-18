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
import {
  readBudgetCandidates,
  readRtbItems,
  readRtbAwards,
} from "@/modules/budgeting/server/services/budget-reads";

export async function loadFundingPhases(
  db: PrismaClient,
  tenantId: TenantId,
  valueStreamId: string,
  cycleKey: string,
  focusArtId?: string | undefined,
): Promise<FundingPhase[]> {
  const [allItems, round, arts] = await Promise.all([
    readRtbItems(db, tenantId),
    db.budgetRound.findFirst({
      where: { tenantId, cycleKey },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
    // `deletedAt: null` — ein gelöschtes ART zählte sonst in „X von Y" mit
    // (REQ-11).
    db.art.findMany({ where: { tenantId, valueStreamId, deletedAt: null }, select: { id: true } }),
  ]);

  // Die Positionen, die den ART-Rahmen bilden.
  const items = allItems.filter(
    (i) => i.valueStreamId === valueStreamId && i.kind === "art_change" && i.active,
  );

  const [allCandidates, allAwards, budgets] = await Promise.all([
    // Der geteilte Lader (REQ-5) — die Zuspruch-Sicht sucht dieselbe Zeile.
    readBudgetCandidates(db, tenantId),
    readRtbAwards(db, tenantId),
    // Zwei Abfragen für alle ARTs des Wertstroms — vorher zwei **je** ART.
    loadArtEpicBudgets(
      db,
      tenantId,
      arts.map((a) => a.id),
      cycleKey,
    ),
  ]);

  // Ist der Zuspruch auf die Positionen dieses Wertstroms aufgeteilt?
  const ownItems = new Set(items.map((i) => i.id));
  const awards = allAwards.filter((a) => a.cycleKey === cycleKey && ownItems.has(a.rtbItemId));

  // Der Kandidat dieses Wertstroms in **dieser** Kachel. `round == null` hiess
  // bisher „gar nicht erst suchen"; jetzt fällt der Fall über `roundId` heraus,
  // das dann auf nichts passt.
  const candidate = allCandidates.find(
    (c) => c.kind === "rtb" && c.valueStreamId === valueStreamId && c.roundId === round?.id,
  );

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
