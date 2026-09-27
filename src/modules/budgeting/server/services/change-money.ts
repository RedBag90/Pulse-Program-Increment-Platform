import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { foldChangeMoney, type ChangeMoney } from "@/modules/budgeting/domain/change-money";
import {
  readArtEpicAllocations,
  readArtOwnWork,
  readBudgetCandidates,
  readRtbAwards,
  readRtbItems,
} from "@/modules/budgeting/server/services/budget-reads";

/** Der Ausschnitt des Clients, den die Faltung braucht — auch ein `tx` erfüllt ihn. */
export type ChangeMoneyReader = Pick<
  PrismaClient,
  | "budgetCandidate"
  | "runTheBusinessItem"
  | "rtbItemAward"
  | "artEpicAllocation"
  | "artOwnWorkAllocation"
>;

/**
 * **Das Veränderungsgeld des Mandanten** (`domain/change-money.ts`) — aus den
 * geteilten Ladern, also je Request **eine** Lesung je Tabelle, wie viele
 * Flächen auch fragen.
 *
 * **In einer Transaktion** reicht der Schreibweg `tx` statt `db`: `cache()`
 * schlüsselt auf das übergebene Objekt, die Zeilen kommen dann aus der
 * Transaktion und sehen deren Stand. So rechnet der Deckel beim Verteilen
 * gegen frische Zahlen, nicht gegen die der Seite.
 */
export async function loadChangeMoney(
  db: ChangeMoneyReader,
  tenantId: TenantId,
): Promise<ChangeMoney> {
  const [candidates, items, awards, epicAllocations, ownWork] = await Promise.all([
    readBudgetCandidates(db, tenantId),
    readRtbItems(db, tenantId),
    readRtbAwards(db, tenantId),
    readArtEpicAllocations(db, tenantId),
    readArtOwnWork(db, tenantId),
  ]);
  return foldChangeMoney({ candidates, items, awards, epicAllocations, ownWork });
}
