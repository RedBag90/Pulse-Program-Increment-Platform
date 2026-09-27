import { isChangeKind } from "@/modules/budgeting/domain/rtb-kind";

/**
 * **Das Veränderungsgeld — einmal gefaltet, von allen Flächen gelesen.**
 *
 * Veränderungsgeld eines ARTs in einem Halbjahr ist:
 *
 *  - **portfolio** — Σ `finalAmount` der Epic-Kandidaten dieses ARTs in einer
 *    Kachel dieses Halbjahrs: das Geld von der Portfolio-Kachel;
 *  - **frame** — der ART-Rahmen: Σ der Zusprüche auf die **aktiven**
 *    `art_change`-Positionen dieses ARTs;
 *  - davon **toEpics** (an ART-Epics vergeben), **toOwnWork** (für ART-eigene
 *    Arbeit reserviert) und **open** (noch nicht vergeben, ungekappt — ein
 *    negativer Rest zeigt einen nachträglich gekürzten Rahmen).
 *
 * Für einen Wertstrom zählt **portfolio** über den Wertstrom des Kandidaten,
 * nicht über seine ARTs: ein Portfolio-Epic ohne ART gehört dem Wertstrom
 * trotzdem. Der Rahmen ist die Summe seiner ARTs.
 *
 * **Warum eine Faltung.** Bis September 2026 stand die Portfolio-Summe an vier
 * Stellen und der Rahmen an drei, jede mit eigener Abfrage: die ART-Übersicht,
 * die Verteil-Matrix, die Deckungsrechnung, der Funding-Snapshot, der
 * Budget-Plan. Der Budget-Plan fror dabei nur das Portfolio-Geld ein, während
 * alle anderen Portfolio plus Rahmen zeigten. Jetzt gibt es die Regel einmal.
 *
 * Betriebsgeld gehört nicht hinein (REQ-10): Veränderung und Betrieb stehen
 * nie in einer Summe.
 *
 * Rein, kein I/O. Geladen wird über `server/services/change-money.ts`.
 */

export interface ChangeMoneyRows {
  candidates: readonly {
    kind: string;
    artId: string | null;
    valueStreamId: string | null;
    finalAmount: number | null;
    cycleKey: string;
  }[];
  items: readonly { id: string; kind: string; artId: string | null; active: boolean }[];
  awards: readonly { rtbItemId: string; cycleKey: string; amount: number }[];
  epicAllocations: readonly { artId: string; cycleKey: string; amount: number }[];
  ownWork: readonly { artId: string; cycleKey: string; amount: number }[];
}

/** Das Veränderungsgeld eines ARTs (oder Wertstroms) in einem Halbjahr. */
export interface ChangeCell {
  portfolio: number;
  frame: number;
  toEpics: number;
  toOwnWork: number;
  /** frame − toEpics − toOwnWork, ungekappt. */
  open: number;
}

export const NO_CHANGE: ChangeCell = { portfolio: 0, frame: 0, toEpics: 0, toOwnWork: 0, open: 0 };

/** Portfolio plus Rahmen — das „ART-Budget" jeder Fläche. */
export const changeTotal = (c: ChangeCell) => c.portfolio + c.frame;

export interface ChangeMoney {
  /** Ein ART in einem Halbjahr; ohne Geld `NO_CHANGE`. */
  art(artId: string, cycleKey: string): ChangeCell;
  /** Die Halbjahre eines ARTs, in denen Geld liegt. */
  artByCycle(artId: string): Record<string, ChangeCell>;
  /**
   * Das „ART-Budget" je Halbjahr — Portfolio plus Rahmen. Nur Halbjahre mit
   * Portfolio-Geld oder Rahmen: eine blosse Zuteilung ohne Rahmen macht noch
   * kein Budget.
   */
  artTotalByCycle(artId: string): Record<string, number>;
  /**
   * Ein Wertstrom in einem Halbjahr: Portfolio über den Wertstrom der
   * Kandidaten, der Rahmen als Summe der übergebenen ARTs.
   */
  valueStream(valueStreamId: string, artIds: readonly string[], cycleKey: string): ChangeCell;
  /** Die Portfolio-Summe eines Wertstroms je Halbjahr. */
  valueStreamPortfolioByCycle(valueStreamId: string): Record<string, number>;
  /** Alle Wertströme mit Portfolio-Geld. */
  valueStreamIds(): string[];
}

type Grid = Map<string, Map<string, ChangeCell>>;

function cell(grid: Grid, id: string, cycleKey: string): ChangeCell {
  let byCycle = grid.get(id);
  if (!byCycle) grid.set(id, (byCycle = new Map()));
  let c = byCycle.get(cycleKey);
  if (!c) byCycle.set(cycleKey, (c = { ...NO_CHANGE }));
  return c;
}

export function foldChangeMoney(rows: ChangeMoneyRows): ChangeMoney {
  const byArt: Grid = new Map();
  const vsPortfolio = new Map<string, Record<string, number>>();

  for (const c of rows.candidates) {
    if (c.kind !== "epic" || c.finalAmount == null) continue;
    if (c.artId != null) cell(byArt, c.artId, c.cycleKey).portfolio += c.finalAmount;
    if (c.valueStreamId != null) {
      const je = vsPortfolio.get(c.valueStreamId) ?? {};
      je[c.cycleKey] = (je[c.cycleKey] ?? 0) + c.finalAmount;
      vsPortfolio.set(c.valueStreamId, je);
    }
  }

  // Nur aktive ART-Rahmen zählen — der Filter, der schon einmal gefehlt hat.
  const artOfFrameItem = new Map(
    rows.items
      .filter((i) => isChangeKind(i.kind) && i.active && i.artId != null)
      .map((i) => [i.id, i.artId!]),
  );
  for (const a of rows.awards) {
    const artId = artOfFrameItem.get(a.rtbItemId);
    if (artId != null) cell(byArt, artId, a.cycleKey).frame += a.amount;
  }
  for (const a of rows.epicAllocations) cell(byArt, a.artId, a.cycleKey).toEpics += a.amount;
  for (const a of rows.ownWork) cell(byArt, a.artId, a.cycleKey).toOwnWork += a.amount;
  for (const byCycle of byArt.values()) {
    for (const c of byCycle.values()) c.open = c.frame - c.toEpics - c.toOwnWork;
  }

  const art = (artId: string, cycleKey: string): ChangeCell => ({
    ...(byArt.get(artId)?.get(cycleKey) ?? NO_CHANGE),
  });

  return {
    art,
    artByCycle: (artId) =>
      Object.fromEntries([...(byArt.get(artId) ?? new Map())].map(([k, c]) => [k, { ...c }])),
    artTotalByCycle: (artId) =>
      Object.fromEntries(
        [...(byArt.get(artId) ?? new Map<string, ChangeCell>())]
          .filter(([, c]) => changeTotal(c) !== 0)
          .map(([k, c]) => [k, changeTotal(c)]),
      ),
    valueStream(valueStreamId, artIds, cycleKey) {
      const out = { ...NO_CHANGE, portfolio: vsPortfolio.get(valueStreamId)?.[cycleKey] ?? 0 };
      for (const id of artIds) {
        const c = art(id, cycleKey);
        out.frame += c.frame;
        out.toEpics += c.toEpics;
        out.toOwnWork += c.toOwnWork;
        out.open += c.open;
      }
      return out;
    },
    valueStreamPortfolioByCycle: (valueStreamId) => ({ ...(vsPortfolio.get(valueStreamId) ?? {}) }),
    valueStreamIds: () => [...vsPortfolio.keys()],
  };
}
