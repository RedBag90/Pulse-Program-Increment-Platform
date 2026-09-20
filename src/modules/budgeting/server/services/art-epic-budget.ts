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
import {
  readRtbItems,
  readRtbAwards,
  readBudgetCandidates,
} from "@/modules/budgeting/server/services/budget-reads";

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
 * **Der ART-Rahmen je Halbjahr**, ueber alle Halbjahre statt eines.
 *
 * Dieselbe Regel wie oben — Σ der Zusprueche auf den aktiven
 * `art_change`-Positionen eines ARTs —, nur ohne Zyklus-Filter. Sie steht hier
 * und nicht beim Aufrufer, damit es die Regel genau einmal gibt: dass ein
 * Rahmen nur zaehlt, solange seine Position **aktiv** ist, ist der Filter, der
 * schon einmal gefehlt hat (`art-epic-budget.ts`, Kopf).
 *
 * Gebraucht von der Deckungsrechnung: der Rahmen ist Veraenderungsgeld und
 * finanziert Features, also gehoert er in die Bezugsgroesse der Last und in den
 * Zaehler des €-Satzes.
 */
export async function loadArtFrameByCycle(
  db: BudgetReader,
  tenantId: TenantId,
  artIds: readonly string[],
): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>(artIds.map((id) => [id, {}]));
  if (artIds.length === 0) return out;

  const ids = new Set(artIds);
  const [items, awards] = await Promise.all([
    readRtbItems(db, tenantId),
    readRtbAwards(db, tenantId),
  ]);

  const artOfItem = new Map(
    items
      .filter((i) => i.kind === "art_change" && i.active && i.artId != null && ids.has(i.artId))
      .map((i) => [i.id, i.artId!]),
  );

  for (const a of awards) {
    const artId = artOfItem.get(a.rtbItemId);
    if (artId == null) continue;
    const byCycle = out.get(artId)!;
    byCycle[a.cycleKey] = (byCycle[a.cycleKey] ?? 0) + a.amount;
  }
  return out;
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
  const [candidates, frames] = await Promise.all([
    readBudgetCandidates(db, tenantId),
    loadArtFrameByCycle(db, tenantId, artIds),
  ]);

  const ids = new Set(artIds);
  const out = new Map<string, Record<string, number>>(
    artIds.map((id) => [id, { ...(frames.get(id) ?? {}) }]),
  );
  for (const c of candidates) {
    if (c.kind !== "epic" || c.artId == null || c.finalAmount == null) continue;
    if (!ids.has(c.artId)) continue;
    const je = out.get(c.artId)!;
    je[c.cycleKey] = (je[c.cycleKey] ?? 0) + c.finalAmount;
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
