/**
 * Pure PI × status-lane matrix for the Delivery-Board (Drumbeat).
 *
 * The board re-buckets on every optimistic drag-drop, so the matrix CANNOT
 * be purely server-emitted — it has to be recomputed client-side from the
 * optimistic feature list. This module owns three things that used to live
 * inline in `cockpit-board.tsx` (and were copy-pasted into `cockpit-table.tsx`):
 *   1. the synthetic Backlog column (features with `piId === null`),
 *   2. the ONE canonical `null ↔ ""` PI-key normalization (`normalizePiKey`),
 *   3. the per-cell membership bucketing (was an O(lanes×cols×features) inline
 *      `filter` in render).
 *
 * Pure: no I/O, no React, no wall-clock Date. The Backlog column carries a
 * constant epoch placeholder date only to satisfy `CockpitPiSlot` — it is
 * never rendered as a real timeline window.
 */

import type {
  CockpitFeature,
  CockpitPiSlot,
  FeatureStatus,
} from "@/modules/drumbeat/domain/cockpit-types";

/** Column id of the synthetic Backlog column — also the empty PI-key. */
export const BACKLOG_COLUMN_ID = "";

/**
 * Column id der synthetischen Überlauf-Spalte.
 *
 * Das Board zeigt ein Fenster von fünf PIs. Ein Feature, dessen PI links oder
 * rechts davon liegt, hatte vorher **keine Zelle** — es wurde weder gerendert
 * noch gemeldet, zählte aber im „N Features im Scope" der Toolbar mit. Wer eine
 * Karte ins übernächste PI schob, sah sie nie wieder.
 */
export const OVERFLOW_COLUMN_ID = "__outside_window__";

/** Lane descriptor the matrix buckets against (structurally the board's `LaneDef`). */
export interface BoardLane {
  value: FeatureStatus;
  label: string;
  color: string;
  /**
   * Wie viele Karten eine Zelle dieser Bahn zeigt, bevor der Rest aufklappt.
   * `undefined` = **keine** Grenze.
   *
   * Die Höhe einer Bahn richtet sich nach ihrer größten Zelle — daneben stehen
   * leere Zellen derselben Höhe. Gemessen trug eine Zelle **44 Karten**, also
   * rund 3800 px, während die Nachbarzellen leer waren.
   *
   * Gestaffelt statt einheitlich, und zwar nach demselben Prinzip wie an den
   * Risiken: *„eine halbe Entscheidungsliste ist keine."* **Blockiert** ist die
   * Tagesordnung, **In Umsetzung** die laufende Arbeit — beide bleiben ganz;
   * eine lange Bahn ist dort kein Anzeigefehler, sondern ein WIP-Signal.
   * **Freigegeben** und **Abgeschlossen** sind Haufen und werden gekappt.
   */
  limit?: number;
}

/** Was eine Zelle zeigt und was sie zurückhält. */
export interface LaneCell {
  /** Die sichtbaren Karten — bei einer Bahn ohne Grenze alle. */
  shown: CockpitFeature[];
  /** Die zurückgehaltenen; leer, wenn nichts gekappt wurde. */
  rest: CockpitFeature[];
}

/**
 * Teilt die Karten einer Zelle in „sichtbar" und „Rest".
 *
 * Rein und einzeln prüfbar: die Grenze ist eine Eigenschaft der **Bahn**, keine
 * Bedingung im JSX. Wer sie ändert, ändert sie an einer Stelle.
 */
export function splitCell(cell: readonly CockpitFeature[], limit?: number): LaneCell {
  if (limit === undefined || cell.length <= limit) return { shown: [...cell], rest: [] };
  return { shown: cell.slice(0, limit), rest: cell.slice(limit) };
}

/**
 * Single owner of the `null ↔ ""` PI-key normalization. A feature with no PI
 * (`piId === null`) belongs to the Backlog column, whose id is the empty string;
 * every call site that compares a feature's PI against a column id MUST route
 * through here so the Backlog column is matched consistently.
 */
export function normalizePiKey(piId: string | null | undefined): string {
  return piId ?? BACKLOG_COLUMN_ID;
}

export interface BoardMatrix {
  /**
   * Backlog zuerst, dann die PI-Spalten des Fensters, zuletzt — **nur wenn sie
   * jemanden trägt** — die Überlauf-Spalte.
   */
  columns: CockpitPiSlot[];
  lanes: readonly BoardLane[];
  /** Bucketed features keyed by `${piKey}:${status}`. */
  cells: Map<string, CockpitFeature[]>;
  /** Features sitting in the `(columnId, status)` cell (empty array if none). */
  cell(columnId: string, status: FeatureStatus): CockpitFeature[];
}

function cellKey(columnId: string, status: FeatureStatus): string {
  return `${columnId}:${status}`;
}

/**
 * Build the PI × status-lane matrix for the given feature snapshot.
 *
 * `pis` are the real PI columns (already carrying their server feature counts);
 * the Backlog column is synthesized here and its count is derived from the
 * passed features (so it tracks the optimistic view, matching prior behavior).
 */
export function buildBoardMatrix(
  features: readonly CockpitFeature[],
  pis: readonly CockpitPiSlot[],
  lanes: readonly BoardLane[],
): BoardMatrix {
  const windowIds = new Set(pis.map((p) => p.id));
  /** Sitzt das Feature in einem PI, das gerade keine Spalte hat? */
  const isOutside = (f: CockpitFeature): boolean => f.piId != null && !windowIds.has(f.piId);

  let backlogCount = 0;
  let overflowCount = 0;
  for (const f of features) {
    if (f.piId == null) backlogCount += 1;
    else if (isOutside(f)) overflowCount += 1;
  }

  const backlogColumn: CockpitPiSlot = {
    id: BACKLOG_COLUMN_ID,
    name: "Backlog",
    startDate: new Date(0),
    endDate: new Date(0),
    status: "backlog",
    featureCount: backlogCount,
    isCurrent: false,
  };
  const columns: CockpitPiSlot[] = [backlogColumn, ...pis];
  if (overflowCount > 0) {
    columns.push({
      id: OVERFLOW_COLUMN_ID,
      name: "Außerhalb des Fensters",
      startDate: new Date(0),
      endDate: new Date(0),
      status: "overflow",
      featureCount: overflowCount,
      isCurrent: false,
    });
  }

  const cells = new Map<string, CockpitFeature[]>();
  for (const f of features) {
    const columnId = isOutside(f) ? OVERFLOW_COLUMN_ID : normalizePiKey(f.piId);
    const key = cellKey(columnId, f.status);
    const bucket = cells.get(key);
    if (bucket) bucket.push(f);
    else cells.set(key, [f]);
  }

  return {
    columns,
    lanes,
    cells,
    cell(columnId: string, status: FeatureStatus): CockpitFeature[] {
      return cells.get(cellKey(columnId, status)) ?? [];
    },
  };
}
