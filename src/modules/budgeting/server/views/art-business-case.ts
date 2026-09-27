/**
 * Der **Business Case eines ARTs** — der Lader zur Herkunftsrechnung.
 *
 * Er zieht die sechs Zahlen aus vier Quellen und reicht sie an die reine
 * Rechnung weiter (`domain/art-budget-origin.ts`). Neue Rundreisen entstehen
 * dabei keine: bis auf die ART-Liste des Stroms liest er ausschliesslich über
 * die geteilten Lader (`budget-reads.ts`), die auf dieser Seite ohnehin schon
 * gelesen werden.
 *
 * **Warum das Betriebsgeld hier anders gerechnet wird als in
 * `art-budget-detail.ts`:** dort fragt `listRtbItems(…, { artId })` nur nach
 * Positionen, die den ART **direkt** tragen. Das ist genau einer der drei Wege
 * — und gemessen der seltenste. Die anderen beiden (über die Solution, über den
 * Schlüssel) fehlten damit auf der ART-Fläche vollständig.
 */

import type { PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { loadChangeMoney } from "@/modules/budgeting/server/services/change-money";
import {
  readRtbItems,
  readRtbAwards,
  readSolutions,
  readValueStreamArts,
} from "@/modules/budgeting/server/services/budget-reads";
import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";
import { rtbAnnualAmount, rtbCycleAmount } from "@/modules/budgeting/domain/rtb-interval";
import {
  resolveRtbToArts,
  type ResolvableRtbPosition,
  type RtbByPath,
} from "@/modules/budgeting/domain/rtb-art-resolution";
import {
  buildArtBudgetOrigin,
  type ArtBudgetOrigin,
  type OriginBasis,
} from "@/modules/budgeting/domain/art-budget-origin";

const KEIN_WEG: RtbByPath = { direct: 0, viaSolution: 0, keyed: 0 };

export async function loadArtBusinessCase(
  db: PrismaClient,
  tenantId: TenantId,
  art: { id: string; valueStreamId: string },
  cycleKey: string,
): Promise<ArtBudgetOrigin> {
  const [money, items, awards, solutions, streamArts] = await Promise.all([
    // Portfolio-Geld und ART-Rahmen aus der Faltung des Veränderungsgeldes.
    loadChangeMoney(db, tenantId),
    readRtbItems(db, tenantId),
    readRtbAwards(db, tenantId),
    readSolutions(db, tenantId),
    // Die Nenner des Schlüssels. **Gelöschte ARTs zählen nicht mit** — sonst
    // verschwände ein Sechstel des übergreifenden Betriebsgeldes in einem ART,
    // den es nicht mehr gibt.
    readValueStreamArts(db, tenantId, art.valueStreamId).then((arts) =>
      [...arts].sort((a, b) => a.id.localeCompare(b.id)),
    ),
  ]);

  const change = money.art(art.id, cycleKey);
  const portfolio = change.portfolio;

  // **Nur Betrieb.** Die `art_change`-Positionen sind der ART-Rahmen; sie
  // stehen bereits als zwei eigene Zeilen in der Gruppe „Veränderung". Hier
  // noch einmal mitgezählt, stünde dasselbe Geld zweimal in Σ gesamt.
  const betrieb = items.filter(
    (i) => i.valueStreamId === art.valueStreamId && i.active && !isChangeKind(i.kind),
  );

  /**
   * **Zugesprochen schlägt beantragt** (REQ-8) — aber die Frage ist eine des
   * ganzen Halbjahres, nicht der einzelnen Position. Sobald der Wertstrom
   * aufgeteilt hat, ist eine Position ohne Zuspruch eine mit **0 €**, keine, für
   * die der geplante Betrag einspringt. Genau so rechnet auch die Aufteil-Fläche.
   */
  const ownItems = new Set(betrieb.map((i) => i.id));
  const zuspruch = new Map(
    awards
      .filter((a) => a.cycleKey === cycleKey && ownItems.has(a.rtbItemId))
      .map((a) => [a.rtbItemId, a.amount] as const),
  );
  const basis: OriginBasis = zuspruch.size > 0 ? "awarded" : "planned";

  const position = (i: (typeof betrieb)[number], amount: number): ResolvableRtbPosition => ({
    id: i.id,
    artId: i.artId,
    solutionId: i.solutionId,
    amount,
  });

  const artOfSolution = Object.fromEntries(solutions.map((s) => [s.id, s.artId]));
  const streamArtIds = streamArts.map((a) => a.id);

  const imHalbjahr = resolveRtbToArts(
    betrieb.map((i) =>
      position(
        i,
        basis === "awarded"
          ? (zuspruch.get(i.id) ?? 0)
          : rtbCycleAmount(i.plannedAmount, i.interval),
      ),
    ),
    artOfSolution,
    streamArtIds,
  );

  /**
   * Der Jahresbetrag kommt **immer** aus der Planung, auch wenn die Beträge des
   * Halbjahres zugesprochen sind: ein Zuspruch gilt für ein Halbjahr, ihn zu
   * verdoppeln wäre eine Hochrechnung, die niemand entschieden hat.
   */
  const imJahr = resolveRtbToArts(
    betrieb.map((i) => position(i, rtbAnnualAmount(i.plannedAmount, i.interval))),
    artOfSolution,
    streamArtIds,
  );

  return buildArtBudgetOrigin({
    cycleKey,
    portfolio,
    frame: {
      total: change.frame,
      toEpics: change.toEpics,
      toOwnWork: change.toOwnWork,
    },
    operating: imHalbjahr.byPath[art.id] ?? KEIN_WEG,
    operatingAnnual: imJahr.byPath[art.id] ?? KEIN_WEG,
    operatingBasis: basis,
  });
}
