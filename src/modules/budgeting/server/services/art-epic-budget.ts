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
 * Die Zahlen kommen aus der Faltung des Veränderungsgeldes
 * (`domain/change-money.ts`) — je Request eine Lesung je Tabelle, unabhängig
 * davon, wie viele ARTs gefragt werden.
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
import { budgetStichtag } from "@/modules/budgeting/domain/budget-stichtag";
import { readBudgetPeriods } from "@/modules/budgeting/server/services/budget-stichtag";
import {
  loadChangeMoney,
  type ChangeMoneyReader,
} from "@/modules/budgeting/server/services/change-money";

/** Der Ausschnitt des Clients, den dieses Modul braucht — auch ein `tx` erfüllt ihn. */
export type BudgetReader = ChangeMoneyReader & Pick<PrismaClient, "budgetRound">;

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
  if (artIds.length === 0) return new Map();

  // Aus der Faltung des Veränderungsgeldes (`change-money.ts`) — dieselbe
  // Regel wie überall: nur aktive ART-Rahmen, Epics und ART-eigene Arbeit
  // zehren denselben Rahmen auf.
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
  const [money, periods] = await Promise.all([
    loadChangeMoney(db, tenantId),
    readBudgetPeriods(db, tenantId),
  ]);

  // Ob das Halbjahr noch verteilt werden darf, sagt der Budget-Stichtag: das
  // laufende, das nächste und die geltende Kachel, auch wenn sie fortgilt.
  const closedReason = budgetStichtag(periods, now).distributionClosedReason(cycleKey);
  return new Map(
    artIds.map((artId) => {
      const c = money.art(artId, cycleKey);
      const distributed = c.toEpics + c.toOwnWork;
      return [
        artId,
        {
          artId,
          cycleKey,
          total: c.frame,
          distributed,
          distributedToEpics: c.toEpics,
          distributedToOwnWork: c.toOwnWork,
          remaining: c.open,
          closedReason,
        },
      ];
    }),
  );
}

/**
 * **Das Veraenderungsgeld eines ARTs je Halbjahr** — Portfolio-Zuteilung
 * **plus** zugesprochener ART-Rahmen.
 *
 * Bis September 2026 gab es dafuer zwei verschiedene Zahlen: die Verteil-Matrix
 * (`getArtBudgetBreakdown`) zaehlte beides, die Deckungsrechnung nur die
 * Portfolio-Zuteilung. Bei Materials & Energy lagen 100.500 € dazwischen — und
 * dieselbe Zahl ist zugleich die Bezugsgroesse der Deckungs-Ampel, der Zaehler
 * des €-Satzes und die Grundlage der Kapazitaetsrechnung. Drei Auskuenfte aus
 * einer Quelle, also darf es die Quelle nur einmal geben.
 *
 * **Betriebsgeld bleibt draussen** (REQ-10). Floesse es hier ein, spraenge die
 * Ampel auf „gedeckt", obwohl kein Euro davon ein Feature bezahlt — und der
 * Satz stiege, weil sein Zaehler waechst und sein Nenner nicht.
 */
export async function loadArtChangeBudgetByCycle(
  db: PrismaClient,
  tenantId: TenantId,
  artIds: readonly string[],
): Promise<Map<string, Record<string, number>>> {
  const money = await loadChangeMoney(db, tenantId);
  return new Map(artIds.map((id) => [id, money.artTotalByCycle(id)]));
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
  return map.get(artId)!;
}
