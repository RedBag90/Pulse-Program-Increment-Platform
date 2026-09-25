/**
 * **Zwei Knoten dürfen nicht übereinanderliegen.**
 *
 * Der Netzplan führt zwei Koordinatensysteme nebeneinander, und bis September
 * 2026 wusste keines vom anderen:
 *
 *  - **dagre** rechnet aus den Abhängigkeiten eine Anordnung — für *alle*
 *    Knoten, auch für die, die längst woanders stehen.
 *  - **Gespeicherte Positionen** (von Hand gezogen) schlugen die berechnete
 *    bedingungslos.
 *
 * Ein neuer Knoten bekam also die rohe dagre-Koordinate aus einem Graphen, in
 * dem die gezogenen Knoten aus dagres Sicht noch in ihren Auto-Slots sitzen.
 * Sobald irgendjemand einmal gezogen hatte, setzte jede Neuanlage in ein Bild,
 * das sie nicht kannte — und landete auf einem bestehenden Feature.
 *
 * Diese Datei ist der fehlende Abgleich. Rein, kein React, kein dagre.
 */

/** Eine Box im Canvas — `x`/`y` ist die linke obere Ecke, wie bei ReactFlow. */
export interface Box {
  x: number;
  y: number;
}

export interface PlacementInput {
  id: string;
  /** Die berechnete Position. */
  position: Box;
  /**
   * `true` = von Hand gesetzt. Solche Knoten **besitzen** ihre Fläche und
   * werden nie bewegt; alle anderen weichen ihnen aus.
   */
  pinned: boolean;
}

export interface PlacementGeometry {
  width: number;
  height: number;
  /** Luft zwischen zwei Boxen, bevor sie als kollidierend gelten. */
  gap: number;
}

function overlaps(a: Box, b: Box, g: PlacementGeometry): boolean {
  return (
    a.x < b.x + g.width + g.gap &&
    b.x < a.x + g.width + g.gap &&
    a.y < b.y + g.height + g.gap &&
    b.y < a.y + g.height + g.gap
  );
}

/**
 * Schiebt kollidierende Knoten auseinander und gibt die Positionen je Id
 * zurück.
 *
 * **Die Regel, in einem Satz:** zuerst die gepinnten — sie stehen, wo sie
 * stehen —, dann die übrigen in der übergebenen Reihenfolge; wessen Box eine
 * belegte schneidet, rückt um eine Knotenhöhe plus Abstand **nach unten**,
 * bis er frei steht.
 *
 * **Nach unten und nicht zur Seite**, weil die x-Achse im `rankdir: "LR"`-
 * Layout Bedeutung trägt: sie ist die Reihenfolge der Abhängigkeiten. Ein
 * Ausweichen nach rechts schöbe den Knoten in einen fremden Rang und
 * behauptete eine Abhängigkeit, die es nicht gibt.
 *
 * Deterministisch: dieselbe Eingabe ergibt dieselbe Ausgabe, und die Schleife
 * endet, weil jeder Schritt echt nach unten geht und die belegten Boxen
 * endlich sind.
 */
export function resolveCollisions(
  nodes: readonly PlacementInput[],
  geometry: PlacementGeometry,
): Map<string, Box> {
  const belegt: Box[] = [];
  const out = new Map<string, Box>();

  // Erst die gepinnten, damit die beweglichen ihnen ausweichen und nicht
  // umgekehrt. Zwei gepinnte, die sich überlappen, bleiben so, wie sie sind:
  // das hat ein Mensch so gewollt.
  for (const n of nodes) {
    if (!n.pinned) continue;
    belegt.push(n.position);
    out.set(n.id, n.position);
  }

  const schritt = geometry.height + geometry.gap;
  for (const n of nodes) {
    if (n.pinned) continue;
    let pos = n.position;
    while (belegt.some((b) => overlaps(pos, b, geometry))) {
      pos = { x: pos.x, y: pos.y + schritt };
    }
    belegt.push(pos);
    out.set(n.id, pos);
  }
  return out;
}
