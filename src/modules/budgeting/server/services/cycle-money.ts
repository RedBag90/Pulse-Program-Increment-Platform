/**
 * **Das Geld eines Halbjahres — was daran hängt, und wie es verschwindet.**
 *
 * Eine Kachel (Runde) trägt einen `cycleKey`, und fast alles Geld, das aus ihr
 * entsteht, liegt **nur an diesem Schlüssel**, nicht an der Runde:
 *
 *  - `rtb_item_awards` — der ART-Topf (`art_change`) und der Run-Zuspruch;
 *  - `art_epic_allocations`, `art_own_work_allocations` — was ein ART aus
 *    seinem Topf weiterverteilt hat;
 *  - `budget_allocations.allocations[cycleKey]` — die Epic-Budgets.
 *
 * Löschte man die Kachel, verschwanden bis September 2026 nur die Runde und
 * ihr Cascade-Baum. Das Geld blieb stehen: im ART stand weiter „200.000 € zu
 * verteilen", obwohl kein Zuspruch mehr dahinterstand — und eine neue Kachel
 * desselben Halbjahres übernahm den alten Topf still, weil die Verbindung nur
 * über den Schlüssel läuft.
 *
 * Diese Datei ist der fehlende Abgleich: sie zeigt vorher, was auf dem Spiel
 * steht, und räumt es in derselben Transaktion ab wie die Runde.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { CycleMoney } from "@/modules/budgeting/domain/cycle-money";
export {
  NO_CYCLE_MONEY,
  cycleMoneyTotal,
  type CycleMoney,
} from "@/modules/budgeting/domain/cycle-money";

type Db = PrismaClient | Prisma.TransactionClient;

/** Der Betrag eines Halbjahres aus einer `allocations`-JSON-Karte. */
function amountIn(allocations: unknown, cycleKey: string): number {
  if (allocations == null || typeof allocations !== "object") return 0;
  const v = (allocations as Record<string, unknown>)[cycleKey];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Was unter diesem Halbjahr an Geld liegt — nur lesend. */
export async function cycleMoneyAtStake(
  db: Db,
  tenantId: string,
  cycleKey: string,
): Promise<CycleMoney> {
  const [awards, epicAllocs, ownWork, budgets] = await Promise.all([
    db.rtbItemAward.findMany({
      where: { tenantId, cycleKey },
      select: { amount: true, rtbItem: { select: { kind: true } } },
    }),
    db.artEpicAllocation.aggregate({ where: { tenantId, cycleKey }, _sum: { amount: true } }),
    db.artOwnWorkAllocation.aggregate({ where: { tenantId, cycleKey }, _sum: { amount: true } }),
    db.budgetAllocation.findMany({ where: { tenantId }, select: { allocations: true } }),
  ]);

  let artFrame = 0;
  let run = 0;
  for (const a of awards) {
    if (a.rtbItem.kind === "art_change") artFrame += Number(a.amount);
    else run += Number(a.amount);
  }
  return {
    artFrame,
    run,
    artDistributed: Number(epicAllocs._sum.amount ?? 0) + Number(ownWork._sum.amount ?? 0),
    epicBudgets: budgets.reduce((s, b) => s + amountIn(b.allocations, cycleKey), 0),
  };
}

/**
 * Räumt das Geld eines Halbjahres ab und gibt zurück, was entfernt wurde.
 *
 * **Muss in derselben Transaktion laufen wie das Löschen der Runde** — sonst
 * bleibt bei einem Fehler dazwischen genau der Rest zurück, gegen den diese
 * Datei gebaut ist.
 */
export async function clearCycleMoney(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cycleKey: string,
  actorId: string,
): Promise<CycleMoney> {
  const vorher = await cycleMoneyAtStake(tx, tenantId, cycleKey);

  await tx.rtbItemAward.deleteMany({ where: { tenantId, cycleKey } });
  await tx.artEpicAllocation.deleteMany({ where: { tenantId, cycleKey } });
  await tx.artOwnWorkAllocation.deleteMany({ where: { tenantId, cycleKey } });

  // Die Epic-Budgets sind eine JSON-Karte je Epic — nur der Schlüssel dieses
  // Halbjahres geht, die anderen Halbjahre bleiben. Eine Zeile, die danach
  // leer ist, trägt nichts mehr und verschwindet.
  const zeilen = await tx.budgetAllocation.findMany({
    where: { tenantId },
    select: { id: true, allocations: true },
  });
  for (const z of zeilen) {
    const karte = (z.allocations ?? {}) as Record<string, unknown>;
    if (!(cycleKey in karte)) continue;
    const { [cycleKey]: _weg, ...rest } = karte;
    if (Object.keys(rest).length === 0) {
      await tx.budgetAllocation.delete({ where: { id: z.id } });
    } else {
      await tx.budgetAllocation.update({
        where: { id: z.id },
        data: { allocations: rest as Prisma.InputJsonValue, updatedBy: actorId },
      });
    }
  }
  return vorher;
}
