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

export interface SwimlaneColumn {
  col: number;
  x0: number;
  x1: number;
}

export interface SwimlaneLayout {
  headers: SwimlaneHeader[];
  features: SwimlanePosition[];
  ghosts: SwimlanePosition[];
  /**
   * Die **linken Kanten** der Spalten, in Spaltenreihenfolge.
   *
   * Sie lagen bis September 2026 nur intern vor. Wer ein Feature auf eine
   * andere Bahn zieht, braucht die Umkehrung — von einer x-Koordinate zurück
   * auf die Spalte —, und die ist ohne diese Zahlen nicht zu haben: die
   * Spaltenbreite hängt davon ab, wie voll die Spalte ist (`maxRows` erzeugt
   * Nebenkolonnen und schiebt alles rechts davon weiter). Eine feste
   * Schrittweite wäre geraten.
   */
  bands: number[];
  /** Die Breite eines Knotens — `columnAt` braucht sie, um Lücken zu erkennen. */
  nodeWidth: number;
  /**
   * **Die Ausdehnung jeder Spalte** — linke und rechte Kante, über alle ihre
   * Nebenkolonnen. Damit lassen sich die Spalten sichtbar voneinander trennen
   * (ein Band je Spalte) und der Mauszeiger beim Ziehen einer Spalte zuordnen
   * (`columnAtPointer`).
   */
  columns: SwimlaneColumn[];
  /** Unterkante der untersten Knotenreihe — bis dorthin reichen die Bänder. */
  contentBottom: number;
  /**
   * Bahn und Reihe je Feature. Damit lässt sich sagen, ob zwei Enden einer
   * Kante in derselben Bahn liegen — und wie weit auseinander. Die Klammer
   * (`targetRightHandleId`) braucht beides.
   */
  colOf: Map<string, number>;
  rowOf: Map<string, number>;
}

/** Eine gerichtete Kante zwischen zwei Knoten-Ids. */
export interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * **Vorgänger oben, Nachfolger unten — innerhalb einer Bahn.**
 *
 * Die Reihenfolge in einer Bahn war die Eingabereihenfolge, und die ist
 * WSJF-absteigend — eine Ordnung, die mit der Abhängigkeitsrichtung nichts zu
 * tun hat. Ein Vorgänger stand so oft *unter* seinem Nachfolger wie darüber,
 * die Kanten liefen in beide Richtungen, und jede davon war ein Umweg um die
 * halbe Bahnbreite.
 *
 * Kahn-Sortierung über die Kanten, deren **beide** Enden in dieser Bahn liegen.
 * Kanten in andere Bahnen ändern die Reihenfolge nicht — sie laufen ohnehin
 * quer, und quer ist in der Zeitachse richtig.
 *
 * **Gleichstand behält die Eingabereihenfolge.** Wer keinen Vorgänger in der
 * Bahn hat, steht so, wie er kam — also weiterhin nach WSJF. Die Sortierung
 * ist stabil: unter den jeweils freien Knoten wird immer der genommen, der in
 * der Eingabe zuerst stand.
 *
 * Ein Zyklus kann nicht vorkommen (der Server verbietet ihn). Kommt trotzdem
 * einer, bricht die Funktion nicht: die verbleibenden Knoten hängen in
 * Eingabereihenfolge hinten an.
 */
export function orderWithinColumn(ids: readonly string[], edges: readonly LayoutEdge[]): string[] {
  const drin = new Set(ids);
  const rang = new Map(ids.map((id, i) => [id, i]));
  const eingang = new Map<string, number>(ids.map((id) => [id, 0]));
  const nach = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const e of edges) {
    if (!drin.has(e.source) || !drin.has(e.target) || e.source === e.target) continue;
    nach.get(e.source)!.push(e.target);
    eingang.set(e.target, (eingang.get(e.target) ?? 0) + 1);
  }

  // Frei = kein offener Vorgänger. Immer der mit dem kleinsten Eingangsrang
  // zuerst — das ist die Stabilität.
  const frei = ids.filter((id) => eingang.get(id) === 0);
  const out: string[] = [];
  const fertig = new Set<string>();
  while (frei.length > 0) {
    frei.sort((a, b) => rang.get(a)! - rang.get(b)!);
    const id = frei.shift()!;
    out.push(id);
    fertig.add(id);
    for (const t of nach.get(id)!) {
      const rest = (eingang.get(t) ?? 1) - 1;
      eingang.set(t, rest);
      if (rest === 0) frei.push(t);
    }
  }
  // Zyklus-Rest, falls es ihn je gibt.
  for (const id of ids) if (!fertig.has(id)) out.push(id);
  return out;
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
  /** Die Kanten — sie ordnen die Knoten **innerhalb** einer Bahn, sonst nichts. */
  edges: readonly LayoutEdge[] = [],
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
  // Je Bahn: Vorgänger nach oben. Ohne Kanten bleibt alles, wie es kam.
  if (edges.length > 0) {
    for (const [col, items] of buckets) {
      const ids = items.flatMap((it) => (it.featureId != null ? [it.featureId] : []));
      if (ids.length < 2) continue;
      buckets.set(
        col,
        orderWithinColumn(ids, edges).map((featureId) => ({ featureId })),
      );
    }
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
  const columns: SwimlaneColumn[] = [];
  let cursor = 0;
  for (let col = 0; col <= externCol; col++) {
    bandX.push(cursor);
    const lanes = lanesOf(col);
    const breite = lanes * nodeWidth + (lanes - 1) * SWIMLANE_LANE_GAP;
    columns.push({ col, x0: cursor, x1: cursor + breite });
    cursor += breite + SWIMLANE_COL_GAP;
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
  const colOf = new Map<string, number>();
  const rowOf = new Map<string, number>();
  for (const [col, items] of buckets) {
    items.forEach((item, idx) => {
      if (item.featureId != null) {
        colOf.set(item.featureId, col);
        rowOf.set(item.featureId, idx);
      }
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

  const tiefsteReihe = Math.max(
    0,
    ...[...buckets.values()].map((items) => Math.min(items.length, maxRows)),
  );
  const contentBottom =
    SWIMLANE_FIRST_ROW_Y +
    Math.max(0, tiefsteReihe) * (nodeHeight + SWIMLANE_ROW_GAP) -
    (tiefsteReihe > 0 ? SWIMLANE_ROW_GAP : 0);

  return {
    headers,
    features,
    ghosts,
    bands: bandX,
    nodeWidth,
    columns,
    contentBottom,
    colOf,
    rowOf,
  };
}

// ---------------------------------------------------------------------------
// columnAt / piOfColumn — die Umkehrung: von der Koordinate zur Bahn
// ---------------------------------------------------------------------------

/**
 * **Auf welcher Bahn liegt diese x-Koordinate?**
 *
 * Die Umkehrung von {@link swimlaneLayout}. Gebraucht wird sie, seit sich
 * Features per Zug in ein anderes PI legen lassen: fällt ein Knoten irgendwo
 * hin, muss daraus eine Spalte werden.
 *
 * **Keine feste Schrittweite.** Eine volle Spalte bricht in Nebenkolonnen und
 * schiebt alle folgenden nach rechts — die Breite ist datenabhängig. Deshalb
 * nimmt die Funktion die Bandkanten entgegen, statt zu rechnen.
 *
 * Zwischen zwei Spalten liegt Luft (`SWIMLANE_COL_GAP`). Ein Knoten, der dort
 * liegen bleibt, gehört zur **letzten begonnenen** Spalte: er ist von ihr aus
 * nach rechts gezogen worden und noch nicht bei der nächsten angekommen. Das
 * ist freundlicher, als die Geste zu verwerfen.
 *
 * `null` nur links vom ersten Band — dort ist gar keine Bahn.
 */
export function columnAt(x: number, bands: readonly number[]): number | null {
  if (bands.length === 0) return null;
  const erste = bands[0]!;
  if (x < erste) return null;
  let treffer = 0;
  for (let col = 0; col < bands.length; col++) {
    if (x >= bands[col]!) treffer = col;
    else break;
  }
  return treffer;
}

/**
 * **Über welcher Spalte ist der Mauszeiger?** — beim Ziehen eines Features.
 *
 * Anders als {@link columnAt}, das die linke obere Ecke eines abgelegten
 * Knotens einordnet, fragt diese Funktion nach dem **Mauszeiger**: dorthin
 * schaut, wer zieht. Die Lücke zwischen zwei Spalten gehört zur
 * **nächstgelegenen** — der Wechsel passiert in der Mitte der Lücke, dort, wo
 * das Auge ihn erwartet. Links der ersten und rechts der letzten Spalte gilt
 * die jeweils äusserste.
 *
 * `null` nur ohne Spalten.
 */
export function columnAtPointer(x: number, columns: readonly SwimlaneColumn[]): number | null {
  if (columns.length === 0) return null;
  let best = columns[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of columns) {
    if (x >= c.x0 && x <= c.x1) return c.col;
    const dist = x < c.x0 ? c.x0 - x : x - c.x1;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.col;
}

/** Wie eine Spalte beim Ziehen aussieht. */
export type ColumnDropState = "idle" | "candidate" | "target" | "own" | "disabled";

/**
 * **Der Zustand einer Spalte während eines Zugs** — rein, damit er testbar
 * ist, ohne React Flow ziehen zu lassen.
 *
 *  - `idle` — es wird nicht gezogen;
 *  - `disabled` — die Spalte nimmt nichts an („Außerhalb des Fensters");
 *  - `own` — die Spalte, aus der das Feature kommt;
 *  - `target` — die Spalte unter dem Mauszeiger, **vor** dem Loslassen;
 *  - `candidate` — jede andere gültige Spalte: sie leuchtet schwach auf,
 *    sobald das Feature angehoben ist.
 */
export function columnDropState(
  col: number,
  drag: { fromCol: number; overCol: number | null } | null,
  pis: readonly { id: string }[],
): ColumnDropState {
  if (drag == null) return "idle";
  if (piOfColumn(col, pis) === undefined) return "disabled";
  if (col === drag.fromCol) return "own";
  if (col === drag.overCol) return "target";
  return "candidate";
}

/**
 * **Welches PI trägt diese Spalte?**
 *
 * `null` heisst **Backlog** — Spalte 0, und das ist ein gültiges Ziel: ein
 * Feature aus einem PI zu nehmen ist eine Planungsentscheidung wie jede andere.
 *
 * `undefined` heisst **kein Ziel**: die Geisterspalte ganz rechts trägt
 * Fremd-Enden, keine eigenen Features. Wer dorthin zieht, hat nichts gesagt.
 *
 * Die Unterscheidung ist der ganze Zweck der Funktion — `null` und „geht
 * nicht" sehen sonst gleich aus, und der Netzplan baute sie bis September 2026
 * an jeder Stelle neu zusammen, wo er sie brauchte.
 */
export function piOfColumn(col: number, pis: readonly { id: string }[]): string | null | undefined {
  if (col === 0) return null;
  if (col > pis.length) return undefined;
  return pis[col - 1]?.id ?? undefined;
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
