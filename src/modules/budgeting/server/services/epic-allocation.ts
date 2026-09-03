import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId, EpicId } from "@/modules/core/kernel/domain/types";
import { parsePeriodAmountMap } from "@/modules/budgeting/domain/budgeting";
import { sumPeriods } from "@/modules/budgeting/domain/period-map";
import { activeCycleFromRounds } from "@/modules/budgeting/domain/budget-cycle";

/**
 * The Epic's budget-allocation summary. Budgeting owns the `budgetAllocation`
 * table; the Epic route consumes this via a port so Work never reads it directly
 * (ADR-0013). `allocatedSum` is the total of the per-period allocations — the
 * Reifegrad sub-header shows "Budget alloziert" when it is > 0. `allocatedByPeriod`
 * carries the per-half-year map (`"YYYY-H1|H2" → €`) for the cost-over-time
 * calculation (Business-case-calculation tab).
 */
export async function getEpicBudgetAllocation(
  db: PrismaClient,
  tenantId: TenantId,
  epicId: EpicId,
): Promise<{ allocatedSum: number; allocatedByPeriod: Record<string, number> } | null> {
  const row = await db.budgetAllocation.findUnique({
    where: { epicId },
    select: { allocations: true, tenantId: true },
  });
  // Tenant-scope defensively — findUnique is by epicId (globally unique), so a
  // cross-tenant epicId must not leak an allocation.
  if (!row || row.tenantId !== tenantId) return null;
  // Parse + sum via the module's shared period-map primitives, so malformed
  // cells are dropped consistently rather than hand-checked here.
  const allocatedByPeriod = parsePeriodAmountMap(row.allocations);
  return { allocatedSum: sumPeriods(allocatedByPeriod), allocatedByPeriod };
}

/**
 * Pro Epic der Allokationsbetrag des **laufenden Budget-Zyklus** (das Halbjahr
 * der laufenden Kachel, s. `activeCycleFromRounds`). Speist die Horizont-Budget-Zeilen des Portfolio-Kanbans
 * über den `BudgetingDataPort` (ADR-0013: Work liest die `budgetAllocation`-Tabelle
 * nie direkt). Nur Nicht-Null-Beträge landen in `byEpic`.
 */
export async function getEpicCycleAllocations(
  db: PrismaClient,
  tenantId: TenantId,
  now: Date,
): Promise<{ cycleKey: string; byEpic: Record<string, number> }> {
  const [rounds, rows] = await Promise.all([
    db.budgetRound.findMany({
      where: { tenantId },
      select: { cycleKey: true, status: true, startDate: true },
    }),
    db.budgetAllocation.findMany({
      where: { tenantId },
      select: { epicId: true, allocations: true },
    }),
  ]);
  const cycleKey = activeCycleFromRounds(rounds, now);
  const byEpic: Record<string, number> = {};
  for (const row of rows) {
    const amount = parsePeriodAmountMap(row.allocations)[cycleKey] ?? 0;
    if (amount !== 0) byEpic[row.epicId] = amount;
  }
  return { cycleKey, byEpic };
}

/**
 * Schreibt den Betrag **eines** Halbjahres in die Zyklus-Karte eines Epics und
 * lässt alle übrigen Zellen stehen.
 *
 * `BudgetAllocation.allocations` ist eine Fortschreibung über alle Halbjahre, in
 * denen das Epic je Geld bekommen hat — nicht der Stand einer Runde. Wer sie
 * schreibt, muss deshalb lesen, die eigene Zelle setzen und den Rest
 * unangetastet zurückschreiben.
 *
 * Bis hierher gab es genau einen Schreiber (die Finalisierung einer Kachel), und
 * die Regel stand inline in ihr. Sie bekommt einen zweiten — die Verteilung des
 * ART-Rahmens —, und zwei Kopien derselben Read-Modify-Write-Regel liefen
 * unweigerlich auseinander. Deshalb hier, an derselben Stelle wie die Leser.
 *
 * Verhalten bewusst unverändert: ein Betrag von 0 schreibt eine 0-Zelle, statt
 * sie zu entfernen — der zweite Schreiber wird das anders brauchen und bekommt
 * dann einen ausdrücklichen Schalter, keine stille Änderung für beide.
 */
export async function mergeEpicAllocation(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: TenantId;
    /** Roher Fremdschlüssel aus derselben Transaktion — die Branded-Ids sichern
     *  Modulgrenzen ab, nicht diesen Aufruf. */
    epicId: string;
    cycleKey: string;
    amount: number;
    actorId: string;
  },
): Promise<void> {
  const existing = await tx.budgetAllocation.findUnique({
    where: { epicId: input.epicId },
    select: { allocations: true },
  });
  const allocations = parsePeriodAmountMap(existing?.allocations);
  allocations[input.cycleKey] = input.amount;
  const json = allocations as unknown as Prisma.InputJsonValue;

  await tx.budgetAllocation.upsert({
    where: { epicId: input.epicId },
    update: { allocations: json, updatedBy: input.actorId },
    create: {
      tenantId: input.tenantId,
      epicId: input.epicId,
      priority: 0,
      allocations: json,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    },
  });
}
