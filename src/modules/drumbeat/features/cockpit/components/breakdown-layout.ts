import type { Translate } from "@/i18n/translate";
import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { EDGE_LABEL as SHARED_EDGE_LABEL } from "@/modules/drumbeat/features/dependencies/components/edge-type-popover";
import {
  type BreakdownGhostNode,
  type BreakdownGraphEdge,
  type BreakdownGraphNode,
  type DependencyEdgeType,
} from "@/modules/drumbeat/server/views/breakdown-network-view";
import { NODE_W_BREAKDOWN } from "@/modules/drumbeat/domain/graph-constants";
import { EDGE_COLOR } from "@/modules/drumbeat/features/cockpit/components/graph-palette";
import { swimlaneLayout } from "@/modules/drumbeat/domain/graph-layout";
import { resolveCollisions, type PlacementInput } from "@/modules/drumbeat/domain/graph-collision";
import { assignHandles } from "@/modules/drumbeat/domain/graph-handles";

/**
 * Layout math for the Epic-Breakdown Netzplan — the two dagre-/swimlane-based
 * algorithms plus their shared node/edge data shapes. Extracted verbatim from
 * `breakdown-network-view.tsx` (behavior-preserving): pure functions taking all
 * inputs as parameters, so they compose in a `useMemo` there. The dagre layout
 * stays client-side (library boundary) — only the pure `swimlaneLayout` is in
 * `domain/`.
 */

export const NODE_WIDTH = NODE_W_BREAKDOWN;

/**
 * **Die Höhe, die der Knoten wirklich hat** — und die er sich deshalb auch
 * nimmt (`FeatureNode` setzt sie als feste Box).
 *
 * Hier stand 96, während der gerenderte Knoten keine Höhe setzte: `p-3`, ein
 * ein- oder zweizeiliger Titel, eine Badge-Zeile — gemessen 60 bis 79 px, und
 * **abhängig vom Inhalt**. Das Layout rechnete also mit Kästen, die es nicht
 * gab, und zwei Knoten nebeneinander waren mal zu weit, mal zu eng.
 *
 * 24 (Innenabstand) + 30 (zwei Titelzeilen à 15, `line-clamp-2` deckelt sie)
 * + 6 (Abstand) + 19 (Badge-Zeile, `text-label` 10px mit `py-0.5`) = 79,
 * aufgerundet. Der Schwester-Graph im Cockpit hält dasselbe Paar seit jeher
 * zusammen (`NODE_H = 64` neben `h-[64px]`); hier fehlte das Gegenstück.
 *
 * **Exakte Geometrie ist Voraussetzung für die Kanten-Brücken**: ein Bogen an
 * einer Kreuzung sitzt nur dann richtig, wenn die Anschlusspunkte dort sind,
 * wo das Layout sie vermutet.
 */
export const NODE_HEIGHT = 80;

/** Luft zwischen zwei Boxen, bevor die Entzerrung sie als kollidierend zählt. */
export const NODE_GAP = 24;
export const EDGE_LABEL = SHARED_EDGE_LABEL;

/**
 * Reine, statische Node-Daten — keine callbacks. Callbacks leben im
 * `BreakdownInteractionContext`, damit `node.data` identitaetsstabil zwischen
 * renders bleibt und React.memo greift.
 */
export interface FeatureNodeData extends BreakdownGraphNode {
  connectable: boolean;
  showPlus: boolean;
  showEdit: boolean;
  artId: string;
}

export interface InsertableEdgeData {
  type: DependencyEdgeType;
  showPlus: boolean;
  /** Source-ART — Lookup-Schluessel fuer Callbacks aus dem Context. */
  sourceArtId: string;
  canChangeType: boolean;
  canInsert: boolean;
}

export interface LayoutCtx {
  /**
   * Der Übersetzer, hereingereicht — das Layout beschriftet Kanten und ist
   * eine reine Funktion (siehe `src/i18n/translate.ts`).
   */
  t: Translate;
  canLinkDependency: boolean;
  canCreateFeature: boolean;
  canEditFeature: boolean;
  /** Persistierte Positionen — Knoten ohne Eintrag bleiben dagre-gelayoutet. */
  savedPositions?: Record<string, { x: number; y: number }> | undefined;
}

export function edgeStyle(type: DependencyEdgeType): {
  style: React.CSSProperties;
  animated: boolean;
  marker: { type: MarkerType; color: string };
} {
  return {
    animated: type === "blocks",
    style: {
      stroke: EDGE_COLOR[type],
      strokeWidth: 1.5,
      strokeDasharray: type === "relates_to" ? "4 4" : undefined,
    },
    marker: { type: MarkerType.ArrowClosed, color: EDGE_COLOR[type] },
  };
}

export function layoutGraph(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
  ghostNodes: BreakdownGhostNode[],
  artById: Map<string, string>,
  ctx: LayoutCtx,
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // Mehr breathing room (nodesep 60, ranksep 160): dagre routet edges
  // nicht knoten-bewusst, also helfen groessere abstaende, dass
  // verbindungen seltener durch zwischennodes durchschlagen.
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 160 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const gn of ghostNodes) {
    g.setNode(gn.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  /**
   * **Erst alle Positionen sammeln, dann entzerren.**
   *
   * Hier stand `saved ? saved : dagre` und sonst nichts: eine gespeicherte
   * Position schlug die berechnete bedingungslos, und ein neuer Knoten bekam
   * die rohe dagre-Koordinate aus einem Graphen, in dem die gezogenen Knoten
   * aus dagres Sicht noch in ihren Auto-Slots sitzen. Sobald einmal jemand
   * gezogen hatte, setzte jede Neuanlage ins Blinde.
   *
   * `resolveCollisions` gleicht die beiden Koordinatensysteme ab: gepinnte
   * Knoten behalten ihren Platz, die übrigen weichen nach unten aus.
   */
  const gewuenscht: PlacementInput[] = [
    ...nodes.map((n) => {
      const d = g.node(n.id);
      const saved = ctx.savedPositions?.[n.id];
      return {
        id: n.id,
        position: saved
          ? { x: saved.x, y: saved.y }
          : { x: d.x - NODE_WIDTH / 2, y: d.y - NODE_HEIGHT / 2 },
        pinned: saved != null,
      };
    }),
    // Geister sind nie gepinnt — sie lassen sich gar nicht ziehen —, brauchen
    // aber denselben Abgleich: `dagrePos` kann fehlen, und dann landeten bisher
    // alle auf demselben Fleck.
    ...ghostNodes.map((gn) => {
      const d = g.node(gn.id) as { x?: number; y?: number } | undefined;
      return {
        id: gn.id,
        position: { x: (d?.x ?? 0) - NODE_WIDTH / 2, y: (d?.y ?? 0) - NODE_HEIGHT / 2 },
        pinned: false,
      };
    }),
  ];
  const platziert = resolveCollisions(gewuenscht, {
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    gap: NODE_GAP,
  });

  const rfNodes: Node[] = nodes.map((n) => {
    const position = platziert.get(n.id) ?? { x: 0, y: 0 };
    const artId = artById.get(n.id) ?? "";
    const data: FeatureNodeData = {
      ...n,
      artId,
      connectable: ctx.canLinkDependency,
      showPlus: ctx.canCreateFeature && artId !== "",
      showEdit: ctx.canEditFeature && artId !== "",
    };
    return {
      id: n.id,
      type: "feature",
      data: data as unknown as Record<string, unknown>,
      position,
    };
  });

  for (const gn of ghostNodes) {
    rfNodes.push({
      id: gn.id,
      type: "ghost",
      data: gn as unknown as Record<string, unknown>,
      position: platziert.get(gn.id) ?? { x: 0, y: 0 },
      draggable: false,
      selectable: true,
    });
  }

  const handles = assignHandles(edges);
  const rfEdges: Edge[] = edges.map((e) => {
    const s = edgeStyle(e.type);
    const anschluss = handles.get(e.id);
    const sourceArtId = artById.get(e.source) ?? "";
    const data: InsertableEdgeData = {
      type: e.type,
      showPlus: ctx.canCreateFeature && sourceArtId !== "",
      sourceArtId,
      canChangeType: ctx.canLinkDependency && sourceArtId !== "",
      canInsert: sourceArtId !== "",
    };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      // Ohne eigene Anschlüsse liefen alle Kanten eines Knotens durch denselben
      // Punkt — und zwei mit gleichen Endpunkten erzeugten dasselbe `d`.
      ...(anschluss ?? {}),
      type: "insertable",
      label: ctx.t(EDGE_LABEL[e.type]),
      animated: s.animated,
      style: s.style,
      markerEnd: s.marker,
      data: data as unknown as Record<string, unknown>,
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

/**
 * PI-Bahnen-Layout (Roadmap-P9). Spalten:
 *   [Backlog, PI_1, PI_2, …, PI_n, Extern]
 * Knoten stapeln innerhalb ihrer Spalte; Ghost-Knoten landen in
 * "Extern" rechts. Pro Spalte ein Header-Node mit dem PI-Namen oben.
 *
 * Edges sind unveraendert — ReactFlow zeichnet Verbindungen quer
 * ueber die Spalten ohne Zutun.
 */
export function layoutByPi(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
  ghostNodes: BreakdownGhostNode[],
  pis: ReadonlyArray<{ id: string; name: string; startDate: string }>,
  artById: Map<string, string>,
  ctx: LayoutCtx,
): { nodes: Node[]; edges: Edge[] } {
  // Reine Swimlane-Positionierung (graph-layout); dieses Component mappt die
  // Positionen nur noch in ReactFlow-Nodes.
  const { headers, features, ghosts } = swimlaneLayout(nodes, ghostNodes, pis);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ghostById = new Map(ghostNodes.map((g) => [g.id, g]));

  const rfNodes: Node[] = [];

  // Header-Nodes pro Spalte.
  for (const h of headers) {
    rfNodes.push({
      id: `pi-header-${h.col}`,
      type: "pi-header",
      data: { label: h.label } as unknown as Record<string, unknown>,
      position: { x: h.x, y: h.y },
      draggable: false,
      selectable: false,
    });
  }

  // Feature-Knoten in ihrer Spalte.
  for (const pos of features) {
    const n = nodeById.get(pos.id);
    if (!n) continue;
    const artId = artById.get(n.id) ?? "";
    const data: FeatureNodeData = {
      ...n,
      artId,
      connectable: ctx.canLinkDependency,
      showPlus: ctx.canCreateFeature && artId !== "",
      showEdit: ctx.canEditFeature && artId !== "",
    };
    rfNodes.push({
      id: n.id,
      type: "feature",
      data: data as unknown as Record<string, unknown>,
      position: { x: pos.x, y: pos.y },
    });
  }

  // Ghost-Knoten in der Extern-Spalte.
  for (const pos of ghosts) {
    const gn = ghostById.get(pos.id);
    if (!gn) continue;
    rfNodes.push({
      id: gn.id,
      type: "ghost",
      data: gn as unknown as Record<string, unknown>,
      position: { x: pos.x, y: pos.y },
      draggable: false,
      selectable: true,
    });
  }

  const handles = assignHandles(edges);
  const rfEdges: Edge[] = edges.map((e) => {
    const s = edgeStyle(e.type);
    const anschluss = handles.get(e.id);
    const sourceArtId = artById.get(e.source) ?? "";
    const data: InsertableEdgeData = {
      type: e.type,
      showPlus: ctx.canCreateFeature && sourceArtId !== "",
      sourceArtId,
      canChangeType: ctx.canLinkDependency && sourceArtId !== "",
      canInsert: sourceArtId !== "",
    };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      // Ohne eigene Anschlüsse liefen alle Kanten eines Knotens durch denselben
      // Punkt — und zwei mit gleichen Endpunkten erzeugten dasselbe `d`.
      ...(anschluss ?? {}),
      type: "insertable",
      label: ctx.t(EDGE_LABEL[e.type]),
      animated: s.animated,
      style: s.style,
      markerEnd: s.marker,
      data: data as unknown as Record<string, unknown>,
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}
