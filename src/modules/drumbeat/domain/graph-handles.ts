/**
 * **Kanten treffen sich nicht mehr in einem Punkt.**
 *
 * Der Netzplan hatte je Knoten genau einen Anschluss links und einen rechts —
 * ohne Id, also nicht einmal adressierbar. Jede Kante, die einen Knoten
 * berührte, lief damit durch denselben Punkt. Und weil die Linie eine **reine
 * Funktion ihrer Endpunkte** ist (`getSmoothStepPath`), erzeugten zwei Kanten
 * mit denselben Endpunkten ein byte-gleiches `d`: perfekt deckungsgleich,
 * unterscheidbar nur, wo die Farbe zufällig abwich. Anklickbar war ohnehin nur
 * die oberste.
 *
 * Die Datenbank lässt drei Abhängigkeiten je Paar zu
 * (`@@unique([fromId, toId, type])`) — der Fall war also nicht exotisch,
 * sondern eingebaut.
 *
 * Diese Datei verteilt die Kanten auf mehrere Anschlüsse je Seite. Rein.
 */

/** Anschlüsse je Seite. Ungerade, damit eine einzelne Kante die Mitte trifft. */
export const HANDLE_SLOTS = 5;

export const sourceHandleId = (slot: number): string => `s${slot}`;
export const targetHandleId = (slot: number): string => `t${slot}`;

/** Die senkrechte Lage eines Anschlusses in Prozent der Knotenhöhe. */
export function handleOffsetPercent(slot: number, slots = HANDLE_SLOTS): number {
  return ((slot + 0.5) / slots) * 100;
}

/**
 * Verteilt `n` Kanten gleichmässig über die Anschlüsse.
 *
 * Eine einzelne Kante bekommt die **Mitte** — das ist der Normalfall und soll
 * aussehen wie vorher. Zwei rücken symmetrisch auseinander, drei nutzen die
 * Ränder mit.
 */
export function slotFor(index: number, count: number, slots = HANDLE_SLOTS): number {
  if (count <= 1) return Math.floor(slots / 2);
  const roh = Math.round(((index + 0.5) / count) * slots - 0.5);
  return Math.min(slots - 1, Math.max(0, roh));
}

export interface HandleAssignment {
  sourceHandle: string;
  targetHandle: string;
}

interface EdgeRef {
  id: string;
  source: string;
  target: string;
}

/**
 * Ordnet jeder Kante einen Anschluss an beiden Enden zu.
 *
 * **Deterministisch**: sortiert wird nach Kanten-Id, damit dasselbe Bild immer
 * gleich aussieht — eine Anordnung, die sich bei jedem Laden ändert, ist
 * schlimmer als eine, die manchmal eng ist.
 *
 * Hat ein Knoten mehr Kanten als Anschlüsse, teilen sich einige wieder einen —
 * dann trennen sie sich am **anderen** Ende, und wo auch das nicht reicht,
 * bleibt die Kreuzungs-Brücke als letzte Auskunft.
 */
export function assignHandles(edges: readonly EdgeRef[]): Map<string, HandleAssignment> {
  const ausgehend = new Map<string, EdgeRef[]>();
  const eingehend = new Map<string, EdgeRef[]>();
  for (const e of [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    (ausgehend.get(e.source) ?? ausgehend.set(e.source, []).get(e.source)!).push(e);
    (eingehend.get(e.target) ?? eingehend.set(e.target, []).get(e.target)!).push(e);
  }

  const out = new Map<string, HandleAssignment>();
  for (const [, liste] of ausgehend) {
    liste.forEach((e, i) => {
      const vorhanden = out.get(e.id);
      out.set(e.id, {
        sourceHandle: sourceHandleId(slotFor(i, liste.length)),
        targetHandle: vorhanden?.targetHandle ?? targetHandleId(slotFor(0, 1)),
      });
    });
  }
  for (const [, liste] of eingehend) {
    liste.forEach((e, i) => {
      const vorhanden = out.get(e.id);
      out.set(e.id, {
        sourceHandle: vorhanden?.sourceHandle ?? sourceHandleId(slotFor(0, 1)),
        targetHandle: targetHandleId(slotFor(i, liste.length)),
      });
    });
  }
  return out;
}
