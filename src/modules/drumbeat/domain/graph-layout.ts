/**
 * Pure, library-free layout math for the Drumbeat dependency graphs.
 *
 * `swimlaneLayout` — PI-swimlane bucketing (the "PI-Bahnen" mode of the
 * Epic-Breakdown network).
 *
 * Pure: no React, no dagre, no I/O, no Date. The dagre-based layouts stay in
 * their client components (library boundary); only this hand-rolled algorithm
 * is shared.
 */

import { NODE_W_BREAKDOWN } from "@/modules/drumbeat/domain/graph-constants";

// ---------------------------------------------------------------------------
// swimlaneLayout — PI-swimlane bucketing (Epic-Breakdown "PI-Bahnen" mode)
// ---------------------------------------------------------------------------

/** Breakdown node height + swimlane geometry — zugleich die Vorgabewerte. */
const BREAKDOWN_NODE_H = 96;
const SWIMLANE_COL_GAP = 160;
/** Abstand zwischen zwei Nebenkolonnen **derselben** Spalte — enger als zwischen Spalten. */
const SWIMLANE_LANE_GAP = 40;
const SWIMLANE_HEADER_HEIGHT = 40;
const SWIMLANE_ROW_GAP = 60;
const SWIMLANE_FIRST_ROW_Y = SWIMLANE_HEADER_HEIGHT + 16;

/**
 * Maße und Beschriftung der Spalten.
 *
 * Die Funktion war auf den Epic-Breakdown festgenagelt: 220 × 96 und die letzte
 * Spalte hieß „Cross-Epic". Das Cockpit-Netz braucht dieselbe Mathematik mit
 * anderen Knoten (200 × 64) und einem anderen Wort für „liegt außerhalb" — und
 * zwar demselben, das die Überlauf-Spalte des Boards trägt.
 *
 * Die Vorgaben sind die alten Werte; der bestehende Aufrufer und seine Tests
 * bleiben damit unangetastet.
 */
export interface SwimlaneGeometry {
  nodeWidth?: number;
  nodeHeight?: number;
  /** Beschriftung der rechten Sammelspalte für Knoten außerhalb des Scopes. */
  externLabel?: string;
  /**
   * Höchste Zahl Knoten je Kolonne; darüber bricht die Spalte in **Nebenkolonnen**
   * um, statt weiter nach unten zu wachsen.
   *
   * Ohne diese Grenze ist eine Spalte so hoch wie ihr vollstes PI: 49 Features
   * ergeben 6000 px. Eine so hohe Leinwand lässt sich nicht mehr auf den Schirm
   * zoomen — React Flow hat einen Zoom-Boden —, und wer zwei Knoten verbinden
   * will, bekommt sie nie gleichzeitig zu sehen. Die Zeitachse bleibt dabei
   * lesbar: die Spalte wird breiter, ihre Reihenfolge von links nach rechts
   * bleibt die Zeit.
   *
   * Vorgabe: kein Umbruch — der Epic-Breakdown bleibt unberührt.
   */
  maxRows?: number;
}

export interface SwimlaneNode {
  id: string;
  piId: string | null;
}

export interface SwimlanePi {
  id: string;
  name: string;
  startDate: string;
}

export interface SwimlaneHeader {
  col: number;
  label: string;
  x: number;
  y: number;
}

export interface SwimlanePosition {
  id: string;
  x: number;
  y: number;
}

export interface SwimlaneLayout {
  headers: SwimlaneHeader[];
  features: SwimlanePosition[];
  ghosts: SwimlanePosition[];
}

/**
 * Bucket feature nodes into swimlane columns:
 *   [Backlog, PI_1, PI_2, …, PI_n, Cross-Epic]
 * A node's column is its PI's position (in `pis` order), Backlog (col 0) when
 * it has no PI, and every ghost node lands in the rightmost "Cross-Epic"
 * column. Items stack vertically within their column, below a per-column
 * header. Returns positions only — edges are unaffected (drawn by ReactFlow).
 */
export function swimlaneLayout(
  nodes: readonly SwimlaneNode[],
  ghostNodes: readonly { id: string }[],
  pis: readonly SwimlanePi[],
  geometry: SwimlaneGeometry = {},
): SwimlaneLayout {
  const nodeWidth = geometry.nodeWidth ?? NODE_W_BREAKDOWN;
  const nodeHeight = geometry.nodeHeight ?? BREAKDOWN_NODE_H;
  const externLabel = geometry.externLabel ?? "Cross-Epic";
  const maxRows = geometry.maxRows ?? Number.POSITIVE_INFINITY;
  // Column index: 0 = Backlog, 1..n = PIs in startDate order, n+1 = Cross-Epic.
  const colByPi = new Map<string, number>();
  pis.forEach((p, i) => colByPi.set(p.id, i + 1));
  const externCol = pis.length + 1;

  // Buckets per column index.
  const buckets = new Map<number, { featureId?: string; ghostId?: string }[]>();
  for (let i = 0; i <= externCol; i++) buckets.set(i, []);

  for (const n of nodes) {
    const col = n.piId == null ? 0 : (colByPi.get(n.piId) ?? 0);
    buckets.get(col)!.push({ featureId: n.id });
  }
  for (const gn of ghostNodes) {
    buckets.get(externCol)!.push({ ghostId: gn.id });
  }

  // Header labels per column.
  const headerLabels: Record<number, string> = { 0: "Backlog", [externCol]: externLabel };
  for (const p of pis) headerLabels[colByPi.get(p.id)!] = p.name;

  // Wie breit eine Spalte ist, hängt davon ab, wie voll sie ist: eine Spalte
  // mit mehr als `maxRows` Knoten bekommt Nebenkolonnen und schiebt damit alle
  // folgenden Spalten nach rechts. Ohne Umbruch (Vorgabe) ist jede Spalte genau
  // einen Knoten breit — dieselbe Rechnung wie zuvor.
  const lanesOf = (col: number) =>
    Math.max(1, Math.ceil((buckets.get(col)?.length ?? 0) / maxRows));
  const bandX: number[] = [];
  let cursor = 0;
  for (let col = 0; col <= externCol; col++) {
    bandX.push(cursor);
    const lanes = lanesOf(col);
    cursor += lanes * nodeWidth + (lanes - 1) * SWIMLANE_LANE_GAP + SWIMLANE_COL_GAP;
  }

  const headers: SwimlaneHeader[] = [];
  for (let col = 0; col <= externCol; col++) {
    headers.push({
      col,
      label: headerLabels[col] ?? "—",
      x: bandX[col]!,
      y: 0,
    });
  }

  const features: SwimlanePosition[] = [];
  const ghosts: SwimlanePosition[] = [];
  for (const [col, items] of buckets) {
    items.forEach((item, idx) => {
      // `idx % Infinity === idx` und `floor(idx / Infinity) === 0`: ohne Umbruch
      // fällt das hier von selbst auf die alte Kolonne zurück.
      const lane = Math.floor(idx / maxRows);
      const row = idx % maxRows;
      const x = bandX[col]! + lane * (nodeWidth + SWIMLANE_LANE_GAP);
      const y = SWIMLANE_FIRST_ROW_Y + row * (nodeHeight + SWIMLANE_ROW_GAP);
      if (item.featureId != null) features.push({ id: item.featureId, x, y });
      else if (item.ghostId != null) ghosts.push({ id: item.ghostId, x, y });
    });
  }

  return { headers, features, ghosts };
}

// ---------------------------------------------------------------------------
// pointsBackwards — die Kante, die gegen die Zeit läuft
// ---------------------------------------------------------------------------

/**
 * **Zeigt diese Abhängigkeit rückwärts in der Zeit?**
 *
 * Sobald die x-Achse des Netzes der PI ist, hat eine Kante eine Richtung in der
 * Zeit. Läuft sie von einem **späteren** PI in ein früheres, ist das ein
 * Planungsfehler: etwas, das später gebaut wird, hält etwas auf, das früher
 * fertig sein soll. Das ist die schärfste Form der Frage „wer wartet auf wen?".
 *
 * `columnOf` liefert die Spalte eines Features — `null`, wenn es keine hat
 * (außerhalb des Fensters). Unbekannte Enden gelten **nicht** als rückwärts:
 * über das, was man nicht sieht, wird nichts behauptet.
 *
 * Der Backlog (Spalte 0) liegt vor allen PIs. Eine Kante aus dem Backlog heraus
 * läuft also immer vorwärts — und eine **hinein** immer rückwärts, was stimmt:
 * etwas Terminiertes kann nicht auf etwas Unterminiertes warten, ohne dass die
 * Terminierung fraglich wird.
 */
export function pointsBackwards(
  dep: { fromId: string; toId: string },
  columnOf: (featureId: string) => number | null,
): boolean {
  const from = columnOf(dep.fromId);
  const to = columnOf(dep.toId);
  if (from === null || to === null) return false;
  return to < from;
}
