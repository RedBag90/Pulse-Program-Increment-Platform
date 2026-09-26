"use client";

import { createContext, useContext, useMemo } from "react";
import { Handle, Position, getSmoothStepPath, type Edge, type Node } from "@xyflow/react";
import {
  HANDLE_SLOTS,
  handleOffsetPercent,
  sourceHandleId,
  targetHandleId,
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

/** `"s3"` → `3`; alles Unbekannte landet in der Mitte. */
function slotOf(handle: string | null | undefined): number {
  const n = Number(String(handle ?? "").slice(1));
  return Number.isFinite(n) ? n : SLOT_MITTE;
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
      const [d] = getSmoothStepPath({
        sourceX: q.x + width,
        sourceY: q.y + (height * handleOffsetPercent(slotOf(e.sourceHandle))) / 100,
        targetX: ziel.x,
        targetY: ziel.y + (height * handleOffsetPercent(slotOf(e.targetHandle))) / 100,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        offset,
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
