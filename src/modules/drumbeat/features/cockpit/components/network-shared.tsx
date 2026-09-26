"use client";

import { createContext, useContext, useMemo } from "react";
import { Handle, Position, getSmoothStepPath, type Edge, type Node } from "@xyflow/react";
import {
  HANDLE_SLOTS,
  handleOffsetPercent,
  isBracketTarget,
  sourceHandleId,
  targetHandleId,
  targetRightHandleId,
} from "@/modules/drumbeat/domain/graph-handles";
import { hopsFor, polylineOf, withHops, type Point } from "@/modules/drumbeat/domain/edge-hops";

/**
 * **Was beide Netzpläne gemeinsam haben.**
 *
 * Der Epic-Breakdown und der Netzplan im Umsetzungsmodul zeigen dieselbe Sache
 * in zwei Maßstäben. Die Verbesserungen vom September 2026 — fünf Anschlüsse je
 * Seite statt einem, Leitungsbrücken an Kreuzungen — lagen zunächst **privat**
 * im Breakdown; der andere Netzplan hätte sie abschreiben müssen, und zwei
 * Kopien laufen irgendwann auseinander.
 *
 * Hier stehen sie einmal. Der einzige Unterschied zwischen den beiden ist die
 * **Geometrie** (200 × 64 gegen 220 × 80), und die reicht der Aufrufer herein.
 *
 * Die reine Mathematik liegt eine Ebene tiefer und weiß von React nichts:
 * `graph-handles.ts` verteilt, `edge-hops.ts` zeichnet die Brücken.
 */

/**
 * **Eine Reihe von Anschlüssen statt eines einzigen.**
 *
 * Vorher hatte jeder Knoten genau ein Ziel links und eine Quelle rechts, beide
 * ohne Id: jede Kante lief durch denselben Punkt, und zwei mit gleichen
 * Endpunkten zeichneten dieselbe Linie. Welche Kante welchen Anschluss nimmt,
 * entscheidet `assignHandles` — hier steht nur, wo sie sitzen.
 */
export function HandleRow({
  type,
  position,
  connectable,
  visible,
}: {
  type: "source" | "target";
  position: Position;
  connectable: boolean;
  visible: boolean;
}) {
  return (
    <>
      {Array.from({ length: HANDLE_SLOTS }, (_, slot) => (
        <Handle
          key={slot}
          id={type === "source" ? sourceHandleId(slot) : targetHandleId(slot)}
          type={type}
          position={position}
          isConnectable={connectable}
          style={{ top: `${handleOffsetPercent(slot)}%` }}
          className={
            visible && connectable
              ? "!size-2 !border !border-background !bg-foreground/60 !opacity-0 transition-opacity group-hover:!opacity-100"
              : "!size-0 !border-none !opacity-0"
          }
        />
      ))}
    </>
  );
}

/**
 * **Die Zielreihe für Klammern — rechts, unsichtbar.**
 *
 * Eine Kante zwischen zwei Knoten derselben Bahn kommt von rechts wieder
 * herein statt links; siehe `targetRightHandleId`. Die Anschlüsse hier sind
 * nie verbindbar und nie sichtbar — sie geben der Kante nur einen Punkt, an
 * dem sie enden kann.
 */
export function BracketTargetRow() {
  return (
    <>
      {Array.from({ length: HANDLE_SLOTS }, (_, slot) => (
        <Handle
          key={slot}
          id={targetRightHandleId(slot)}
          type="target"
          position={Position.Right}
          isConnectable={false}
          style={{ top: `${handleOffsetPercent(slot)}%` }}
          className="!size-0 !border-none !opacity-0"
        />
      ))}
    </>
  );
}

/**
 * **Die fertigen Linien, je Kante.**
 *
 * Eine Kante, die ihren Pfad selbst rechnet, kann nicht wissen, ob sie eine
 * andere kreuzt — jede rechnete ihre eigene und keine wusste von den anderen.
 *
 * Wer hier nichts findet, zeichnet seine eigene Linie: die Brücken sind eine
 * Zugabe, keine Voraussetzung.
 */
export const EdgePathContext = createContext<ReadonlyMap<string, string>>(new Map());

export function useEdgePath(id: string): string | undefined {
  return useContext(EdgePathContext).get(id);
}

/** Die Maße, in denen ein Netzplan zeichnet. */
export interface NetworkGeometry {
  width: number;
  height: number;
  /** `offset`/`borderRadius` von `getSmoothStepPath` — beide Pläne führen dieselben. */
  offset?: number;
  borderRadius?: number;
}

const SLOT_MITTE = Math.floor(HANDLE_SLOTS / 2);

/** Wie weit die innerste Klammer in die Gasse greift, und je Stufe mehr. */
const BRACKET_OFFSET = 24;
const BRACKET_STEP = 12;

/**
 * `"s3"` → `3`, `"tr2"` → `2`; alles Unbekannte landet in der Mitte.
 *
 * Die erste Fassung hielt diese Zusage nicht: `Number("")` ist `0`, und
 * `isFinite(0)` ist wahr — eine Kante **ohne** Anschluss (die optimistische
 * `tmp-`-Kante) landete auf Slot 0, also bei 10 % der Höhe statt bei 50 %.
 */
export function slotOf(handle: string | null | undefined): number {
  const m = /^[a-z]+(\d+)$/.exec(handle ?? "");
  return m ? Number(m[1]) : SLOT_MITTE;
}

/**
 * **Alle Linien auf einmal — samt Brücken.**
 *
 * Über die **Live**-Positionen der Knoten, nicht über das Layout-Ergebnis:
 * sonst stünden die Bögen nach jedem Ziehen falsch.
 *
 * Dass die Endpunkte exakt bestimmbar sind, verdankt sich der festen
 * Knotenbox — die Anschlüsse sitzen auf bekannten Bruchteilen der Höhe. Wäre
 * die Höhe inhaltsabhängig, wäre jede Rechnung darüber geraten.
 */
export function useEdgePaths(
  nodes: readonly Node[],
  edges: readonly Edge[],
  geometry: NetworkGeometry,
): ReadonlyMap<string, string> {
  const { width, height, offset = 32, borderRadius = 16 } = geometry;
  return useMemo(() => {
    const posOf = new Map(nodes.map((n) => [n.id, n.position]));

    const roh: { id: string; d: string; points: Point[] }[] = [];
    for (const e of edges) {
      const q = posOf.get(e.source);
      const ziel = posOf.get(e.target);
      if (q == null || ziel == null) continue;

      /**
       * **Klammer oder Bogen.** Läuft die Kante von rechts ins Ziel
       * (`tr…`), liegen beide Enden in derselben Bahn: Quelle **und** Ziel
       * auf `Right`, und `getSmoothStepPath` zeichnet von selbst die Klammer
       * neben der Bahn — `offset` breit. Längere Klammern greifen weiter
       * aus, damit sie sich nicht mit kürzeren überlagern.
       */
      const klammer = isBracketTarget(e.targetHandle);
      const tiefe = (e.data as { bracketDepth?: number } | undefined)?.bracketDepth ?? 0;
      const [d] = getSmoothStepPath({
        sourceX: q.x + width,
        sourceY: q.y + (height * handleOffsetPercent(slotOf(e.sourceHandle))) / 100,
        targetX: klammer ? ziel.x + width : ziel.x,
        targetY: ziel.y + (height * handleOffsetPercent(slotOf(e.targetHandle))) / 100,
        sourcePosition: Position.Right,
        targetPosition: klammer ? Position.Right : Position.Left,
        offset: klammer ? BRACKET_OFFSET + BRACKET_STEP * tiefe : offset,
        borderRadius,
      });
      roh.push({ id: e.id, d, points: polylineOf(d) });
    }

    const out = new Map<string, string>();
    for (const kante of roh) {
      if (kante.points.length < 2) continue;
      out.set(kante.id, withHops(kante.d, hopsFor(kante.id, kante.points, roh)));
    }
    return out;
  }, [nodes, edges, width, height, offset, borderRadius]);
}

/**
 * **Unbeteiligtes abblenden.**
 *
 * Ein Abhängigkeitsgraph mit dreissig Kanten ist als Ganzes nicht lesbar —
 * lesbar ist die Frage „woran hängt *dieses* Feature". Beim Überfahren oder
 * Wählen eines Knotens treten seine Kanten und Nachbarn hervor, alles andere
 * wird blass. Die Geometrie bleibt; nur die Aufmerksamkeit wird gelenkt.
 *
 * Das ist der dritte Hebel gegen das Kantenchaos, und der einzige, der auch
 * in der Topologie wirkt: dort ordnet dagre schon nach Abhängigkeit, und die
 * beiden anderen Hebel (Reihenfolge in der Bahn, Klammer) greifen nicht.
 *
 * Ohne Fokus kommen die Eingaben unverändert zurück — dieselben Referenzen,
 * kein Neuzeichnen.
 */
export function useFocusDimming(
  nodes: readonly Node[],
  edges: readonly Edge[],
  focusId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    if (focusId == null) return { nodes: nodes as Node[], edges: edges as Edge[] };
    const nah = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) nah.add(e.target);
      if (e.target === focusId) nah.add(e.source);
    }
    return {
      nodes: nodes.map((n) =>
        nah.has(n.id) ? n : { ...n, style: { ...(n.style ?? {}), opacity: 0.35 } },
      ),
      edges: edges.map((e) =>
        e.source === focusId || e.target === focusId
          ? e
          : { ...e, style: { ...(e.style ?? {}), opacity: 0.12 } },
      ),
    };
  }, [nodes, edges, focusId]);
}
