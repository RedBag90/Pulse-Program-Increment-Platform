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

/**
 * Layout math for the Epic-Breakdown Netzplan — the two dagre-/swimlane-based
 * algorithms plus their shared node/edge data shapes. Extracted verbatim from
 * `breakdown-network-view.tsx` (behavior-preserving): pure functions taking all
 * inputs as parameters, so they compose in a `useMemo` there. The dagre layout
 * stays client-side (library boundary) — only the pure `swimlaneLayout` is in
 * `domain/`.
 */

export const NODE_WIDTH = NODE_W_BREAKDOWN;
export const NODE_HEIGHT = 96;
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

  const rfNodes: Node[] = nodes.map((n) => {
    const dagrePos = g.node(n.id);
    const saved = ctx.savedPositions?.[n.id];
    const position = saved
      ? { x: saved.x, y: saved.y }
      : { x: dagrePos.x - NODE_WIDTH / 2, y: dagrePos.y - NODE_HEIGHT / 2 };
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
    const dagrePos = g.node(gn.id);
    rfNodes.push({
      id: gn.id,
      type: "ghost",
      data: gn as unknown as Record<string, unknown>,
      position: {
        x: (dagrePos?.x ?? 0) - NODE_WIDTH / 2,
        y: (dagrePos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      draggable: false,
      selectable: true,
    });
  }

  const rfEdges: Edge[] = edges.map((e) => {
    const s = edgeStyle(e.type);
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
      type: "insertable",
      label: EDGE_LABEL[e.type],
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

  const rfEdges: Edge[] = edges.map((e) => {
    const s = edgeStyle(e.type);
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
      type: "insertable",
      label: EDGE_LABEL[e.type],
      animated: s.animated,
      style: s.style,
      markerEnd: s.marker,
      data: data as unknown as Record<string, unknown>,
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}
