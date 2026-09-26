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
/**
 * Ein **Ziel auf der rechten Seite** — für die Klammer.
 *
 * Zwei Knoten derselben Bahn liegen übereinander. Eine Kante, die rechts
 * heraus- und links wieder hineinläuft, muss um den Knoten herum: 264 px
 * Umweg für 124 px Höhe, und alle solchen Kanten auf denselben zwei
 * Korridoren. Läuft sie stattdessen rechts hinein, wird sie zur Klammer neben
 * der Bahn — sie quert nichts und läuft durch keinen Knoten dazwischen.
 *
 * Versteckt und nicht verbindbar: sie dient der Führung, nicht der Geste.
 */
export const targetRightHandleId = (slot: number): string => `tr${slot}`;

/** Läuft diese Kante von rechts ins Ziel — ist sie also eine Klammer? */
export const isBracketTarget = (handle: string | null | undefined): boolean =>
  typeof handle === "string" && handle.startsWith("tr");

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
  /**
   * Wie weit die Klammer in die Gasse greift, 0 = innerste. Nur bei
   * Klammern gesetzt. Längere Klammern liegen aussen, damit sich kurze und
   * lange nicht überlagern.
   */
  bracketDepth?: number;
}

interface EdgeRef {
  id: string;
  source: string;
  target: string;
  /** Beide Enden in derselben Bahn — dann wird die Kante eine Klammer. */
  sameColumn?: boolean;
  /** Wie viele Reihen die Kante überspannt (nur bei `sameColumn`). */
  span?: number;
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
      const slot = slotFor(i, liste.length);
      out.set(e.id, {
        sourceHandle: vorhanden?.sourceHandle ?? sourceHandleId(slotFor(0, 1)),
        targetHandle: e.sameColumn ? targetRightHandleId(slot) : targetHandleId(slot),
        // Eine Reihe Abstand = innerste Klammer; jede weitere Reihe eine
        // Stufe weiter aussen, gedeckelt auf die Zahl der Anschlüsse.
        ...(e.sameColumn
          ? { bracketDepth: Math.min(HANDLE_SLOTS - 1, Math.max(0, (e.span ?? 1) - 1)) }
          : {}),
      });
    });
  }
  return out;
}
