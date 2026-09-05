/**
 * Das **ART-Epic-Budget** — das Geld, mit dem ein ART seine kleinen Epics
 * finanziert, in seinen drei Zuständen: beantragt, **zugesprochen**, verteilt.
 * Dieses Modul beantwortet die mittleren beiden.
 *
 * **Die Schnittstelle fragt nach einer Menge von ARTs, nicht nach einem.** Das
 * ist der Punkt: alle Sichten außer der Detailseite fragen plural — die
 * ART-Liste, der Leitfaden des Wertstroms, die offenen Aufgaben. Solange die
 * Schnittstelle singular war, musste jede von ihnen eine Schleife bauen, und
 * jede Schleife kostete zwei bis drei Abfragen **je ART**. Der Einzelfall ist
 * hier der Sonderfall der Menge, nicht umgekehrt.
 *
 * Zwei Abfragen, unabhängig davon, wie viele ARTs gefragt werden:
 *
 *  1. die Awards der **aktiven** `art_change`-Positionen dieser ARTs im Zyklus
 *     — der Filter über die Relation, damit die Positionen nicht erst einzeln
 *     geholt werden müssen;
 *  2. die Zuteilungen dieser ARTs im Zyklus.
 *
 * Vorher stand die Rechnung *zugesprochen − verteilt = Rest* an **vier**
 * Stellen: hier, im Leitfaden, in den offenen Aufgaben und noch einmal inline
 * auf der ART-Liste. Genau dort saßen zuletzt der fehlende `active`-Filter und
 * eine zweite, wortgleiche Summenbildung. Jetzt gibt es eine Stelle — und mit
 * ihr eine Stelle, an der der Filter geprüft wird.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";

/** Weitergereicht, damit Aufrufer die Form nicht zweimal suchen müssen. */
export type { ArtEpicBudget };
import { potWindowClosedReason } from "@/modules/budgeting/domain/art-pot-window";

/** Der Ausschnitt des Clients, den dieses Modul braucht — auch ein `tx` erfüllt ihn. */
export type BudgetReader = Pick<PrismaClient, "rtbItemAward" | "artEpicAllocation">;

/** Ein ART ohne Budget — damit Aufrufer nicht auf `undefined` prüfen müssen. */
function empty(artId: string, cycleKey: string, closedReason: string | null): ArtEpicBudget {
  return { artId, cycleKey, total: 0, distributed: 0, remaining: 0, closedReason };
}

/**
 * Das ART-Epic-Budget mehrerer ARTs in **einem** Halbjahr.
 *
 * Die Karte enthält **jeden** angefragten ART, auch die ohne Budget — der
 * Aufrufer soll nicht zwischen „kein Budget" und „nicht gefragt" unterscheiden
 * müssen.
 */
export async function loadArtEpicBudgets(
  db: BudgetReader,
  tenantId: string,
  artIds: readonly string[],
  cycleKey: string,
  now: Date = new Date(),
): Promise<Map<string, ArtEpicBudget>> {
  const closedReason = potWindowClosedReason(cycleKey, now);
  const out = new Map<string, ArtEpicBudget>(
    artIds.map((id) => [id, empty(id, cycleKey, closedReason)]),
  );
  if (artIds.length === 0) return out;

  const ids = [...artIds];
  const [awards, allocations] = await Promise.all([
    // Der Filter geht über die Relation: so entfällt die separate Abfrage der
    // Positionen, die vorher je ART einmal lief.
    db.rtbItemAward.findMany({
      where: {
        tenantId,
        cycleKey,
        rtbItem: { artId: { in: ids }, kind: "art_change", active: true },
      },
      select: { amount: true, rtbItem: { select: { artId: true } } },
    }),
    db.artEpicAllocation.findMany({
      where: { tenantId, cycleKey, artId: { in: ids } },
      select: { artId: true, amount: true },
    }),
  ]);

  for (const a of awards) {
    const artId = a.rtbItem?.artId;
    const row = artId == null ? undefined : out.get(artId);
    if (row) row.total += Number(a.amount);
  }
  for (const a of allocations) {
    const row = out.get(a.artId);
    if (row) row.distributed += Number(a.amount);
  }
  for (const row of out.values()) row.remaining = row.total - row.distributed;

  return out;
}

/**
 * Das Budget **eines** ARTs — der Sonderfall der Menge.
 *
 * Bleibt als eigene Funktion, weil die Schreibwege ihn in ihrer Transaktion
 * brauchen und dort ein `Map`-Umweg nur Rauschen wäre.
 */
export async function loadArtEpicBudget(
  db: BudgetReader,
  tenantId: string,
  artId: string,
  cycleKey: string,
  now: Date = new Date(),
): Promise<ArtEpicBudget> {
  const map = await loadArtEpicBudgets(db, tenantId, [artId], cycleKey, now);
  return map.get(artId) ?? empty(artId, cycleKey, potWindowClosedReason(cycleKey, now));
}
