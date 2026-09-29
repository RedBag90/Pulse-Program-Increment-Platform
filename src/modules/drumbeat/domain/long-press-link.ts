/**
 * **Abhängigkeiten per Touch: halten, ziehen, loslassen.** Die reine Hälfte
 * der Geste — welches Ende einer Kante gegriffen wird und was das Loslassen
 * über einem Feature bedeutet. Die Ereignisse selbst verarbeitet
 * `use-long-press-link.ts`.
 */

export interface Point {
  x: number;
  y: number;
}

/** Was der Finger nach dem Halten trägt. */
export type LinkGesture =
  | { kind: "create"; fromId: string }
  | {
      kind: "relink";
      depId: string;
      fromId: string;
      toId: string;
      /** Das gegriffene Ende; das andere bleibt fest. */
      end: "from" | "to";
    };

/** Was beim Loslassen geschieht; `null` = nichts. */
export type LinkDrop =
  | { kind: "create"; fromId: string; toId: string }
  | { kind: "relink"; depId: string; newFromId: string; newToId: string };

const abstand = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Das Ende, das dem Finger näher liegt. Wer eine Kante am Pfeil hält, meint
 * das Ziel; wer sie am Anfang hält, die Quelle. Gleichstand: das Ziel — es
 * wird häufiger versetzt.
 */
export function nearerEnd(finger: Point, from: Point, to: Point): "from" | "to" {
  return abstand(finger, from) < abstand(finger, to) ? "from" : "to";
}

/**
 * Loslassen über `targetId` (oder über nichts). Ein Feature auf sich selbst,
 * eine unveränderte Kante oder kein Ziel ergeben nichts — der Server bekäme
 * sonst eine Anfrage, die er ohnehin abweist.
 */
export function resolveDrop(gesture: LinkGesture, targetId: string | null): LinkDrop | null {
  if (targetId == null) return null;
  if (gesture.kind === "create") {
    if (targetId === gesture.fromId) return null;
    return { kind: "create", fromId: gesture.fromId, toId: targetId };
  }
  const newFromId = gesture.end === "from" ? targetId : gesture.fromId;
  const newToId = gesture.end === "to" ? targetId : gesture.toId;
  if (newFromId === newToId) return null;
  if (newFromId === gesture.fromId && newToId === gesture.toId) return null;
  return { kind: "relink", depId: gesture.depId, newFromId, newToId };
}
