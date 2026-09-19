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
 * Drei Abfragen, unabhängig davon, wie viele ARTs gefragt werden:
 *
 *  1. die Awards der **aktiven** `art_change`-Positionen dieser ARTs im Zyklus
 *     — der Filter über die Relation, damit die Positionen nicht erst einzeln
 *     geholt werden müssen;
 *  2. die Zuteilungen dieser ARTs im Zyklus;
 *  3. ihre Reservierungen für ART-eigene Arbeit ohne Epic.
 *
 * Vorher stand die Rechnung *zugesprochen − verteilt = Rest* an **vier**
 * Stellen: hier, im Leitfaden, in den offenen Aufgaben und noch einmal inline
 * auf der ART-Liste. Genau dort saßen zuletzt der fehlende `active`-Filter und
 * eine zweite, wortgleiche Summenbildung. Jetzt gibt es eine Stelle — und mit
 * ihr eine Stelle, an der der Filter geprüft wird.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/** Weitergereicht, damit Aufrufer die Form nicht zweimal suchen müssen. */
export type { ArtEpicBudget };
import { potWindowClosedReason } from "@/modules/budgeting/domain/art-pot-window";
import { readRtbItems, readRtbAwards } from "@/modules/budgeting/server/services/budget-reads";

/** Der Ausschnitt des Clients, den dieses Modul braucht — auch ein `tx` erfüllt ihn. */
export type BudgetReader = Pick<
  PrismaClient,
  "rtbItemAward" | "artEpicAllocation" | "artOwnWorkAllocation" | "runTheBusinessItem"
>;

/** Ein ART ohne Budget — damit Aufrufer nicht auf `undefined` prüfen müssen. */
function empty(artId: string, cycleKey: string, closedReason: string | null): ArtEpicBudget {
  return {
    artId,
    cycleKey,
    total: 0,
    distributed: 0,
    distributedToEpics: 0,
    distributedToOwnWork: 0,
    remaining: 0,
    closedReason,
  };
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
  tenantId: TenantId,
  artIds: readonly string[],
  cycleKey: string,
  now: Date = new Date(),
): Promise<Map<string, ArtEpicBudget>> {
  const closedReason = potWindowClosedReason(cycleKey, now);
  const out = new Map<string, ArtEpicBudget>(
    artIds.map((id) => [id, empty(id, cycleKey, closedReason)]),
  );
  if (artIds.length === 0) return out;

  const ids = new Set(artIds);
  // Über die geteilten Lader (REQ-5). Der Filter ging bisher über die Relation
  // `rtbItem` — eine eigene Rundreise, obwohl beide Tabellen auf jeder
  // Budget-Fläche ohnehin schon gelesen werden.
  //
  // **Und das gilt auch in der Transaktion.** `setArtEpicAllocation` und
  // `saveArtEpicAllocations` rufen diese Funktion mit `tx` statt `db`, um den
  // Deckel zu rechnen. Das bleibt richtig: `react.cache` schlüsselt auf das
  // übergebene Objekt, und `tx` ist je Transaktion ein neues — die Lesung
  // passiert also **in** der Transaktion und sieht deren Stand, nicht den der
  // Seite, die sie ausgelöst hat.
  //
  // Die Grenze, an der das kippen würde: ein zweiter Aufruf **nach** einem
  // Schreibvorgang derselben Transaktion bekäme den Stand von vorher. Beide
  // Schreibwege rufen genau einmal, vor ihrem Schreibvorgang. Wer das ändert,
  // ändert einen Geld-Deckel — deshalb steht es hier.
  const [items, awards, allocations, ownWork] = await Promise.all([
    readRtbItems(db, tenantId),
    readRtbAwards(db, tenantId),
    db.artEpicAllocation.findMany({
      where: { tenantId, cycleKey, artId: { in: [...ids] } },
      select: { artId: true, amount: true },
    }),
    // Die Reservierung für ART-eigene Arbeit zehrt denselben Rahmen auf. Sie
    // gehört deshalb hierher und nicht in die Fläche: `remaining` speist die
    // Reiterschiene, die Kette und die Inbox — alle drei sollen dieselbe Zahl
    // sehen.
    db.artOwnWorkAllocation.findMany({
      where: { tenantId, cycleKey, artId: { in: [...ids] } },
      select: { artId: true, amount: true },
    }),
  ]);

  // Welche Position zahlt auf welchen ART ein — nur aktive ART-Rahmen zählen.
  const artOfItem = new Map(
    items
      .filter((i) => i.kind === "art_change" && i.active && i.artId != null)
      .map((i) => [i.id, i.artId!]),
  );

  for (const a of awards) {
    if (a.cycleKey !== cycleKey) continue;
    const artId = artOfItem.get(a.rtbItemId);
    const row = artId == null ? undefined : out.get(artId);
    if (row) row.total += a.amount;
  }
  for (const a of allocations) {
    const row = out.get(a.artId);
    if (row) row.distributedToEpics += Number(a.amount);
  }
  for (const a of ownWork) {
    const row = out.get(a.artId);
    if (row) row.distributedToOwnWork += Number(a.amount);
  }
  for (const row of out.values()) {
    row.distributed = row.distributedToEpics + row.distributedToOwnWork;
    row.remaining = row.total - row.distributed;
  }

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
  tenantId: TenantId,
  artId: string,
  cycleKey: string,
  now: Date = new Date(),
): Promise<ArtEpicBudget> {
  const map = await loadArtEpicBudgets(db, tenantId, [artId], cycleKey, now);
  return map.get(artId) ?? empty(artId, cycleKey, potWindowClosedReason(cycleKey, now));
}
