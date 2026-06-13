"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@/i18n/navigation";
import {
  buildBreakdownGraph,
  type BreakdownGraphEdge,
  type BreakdownGraphNode,
  type DependencyEdgeType,
} from "@/server/views/breakdown-network-view";

interface Props {
  features: ReadonlyArray<{
    id: string;
    title: string;
    status: string;
    artName: string;
    featureType: string | null;
    wsjfComputed: number | null;
  }>;
  dependencies: ReadonlyArray<{
    id: string;
    fromId: string;
    toId: string;
    type: string;
  }>;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;

const EDGE_COLOR: Record<DependencyEdgeType, string> = {
  blocks: "#ef4444",
  depends_on: "#d97706",
  relates_to: "#94a3b8",
};
const EDGE_LABEL: Record<DependencyEdgeType, string> = {
  blocks: "blocks",
  depends_on: "depends on",
  relates_to: "relates to",
};
const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  in_review: "bg-amber-400",
  approved: "bg-emerald-400",
  in_progress: "bg-primary",
  blocked: "bg-red-500",
  completed: "bg-emerald-500",
};
const TIER_BADGE: Record<BreakdownGraphNode["wsjfTier"], string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-muted text-muted-foreground",
  unscored: "bg-muted text-muted-foreground",
};

function FeatureNode({ data }: NodeProps) {
  const node = data as unknown as BreakdownGraphNode;
  const isEnabler = node.featureType === "enabler";
  return (
    <Link
      href={`/umsetzung/feature/${node.id}` as never}
      className="block rounded-lg border border-border bg-card p-3 text-left text-xs no-underline shadow-sm transition-colors hover:bg-muted/40"
      style={{ width: NODE_WIDTH }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={`size-2 shrink-0 rounded-full ${STATUS_DOT[node.status] ?? "bg-muted-foreground/40"}`}
          aria-hidden
        />
        <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-tight text-foreground">
          {node.title}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span
          className={`rounded-full px-1.5 py-0.5 ${isEnabler ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}
        >
          {isEnabler ? "Enabler" : "Feature"}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 ${TIER_BADGE[node.wsjfTier]}`}>
          WSJF {node.wsjfComputed != null ? node.wsjfComputed.toFixed(1) : "—"}
        </span>
        <span className="ml-auto truncate text-muted-foreground">{node.artName}</span>
      </div>
    </Link>
  );
}

const NODE_TYPES = { feature: FeatureNode };

function layoutGraph(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  const rfNodes: Node[] = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "feature",
      data: n as unknown as Record<string, unknown>,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  const rfEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: EDGE_LABEL[e.type],
    type: "smoothstep",
    animated: e.type === "blocks",
    style: {
      stroke: EDGE_COLOR[e.type],
      strokeWidth: 1.5,
      strokeDasharray: e.type === "relates_to" ? "4 4" : undefined,
    },
    labelStyle: { fill: EDGE_COLOR[e.type], fontSize: 10 },
    labelBgStyle: { fill: "white" },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR[e.type] },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

export function BreakdownNetworkView({ features, dependencies }: Props) {
  const model = useMemo(
    () => buildBreakdownGraph({ features, dependencies }),
    [features, dependencies],
  );
  const { nodes, edges } = useMemo(
    () => layoutGraph(model.nodes, model.edges),
    [model.nodes, model.edges],
  );

  if (model.nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Noch keine Features in diesem Epic — lege das erste Feature in der Liste an.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {model.droppedEdgeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {model.droppedEdgeCount} Abhängigkeit{model.droppedEdgeCount === 1 ? "" : "en"} mit
          Endpunkten ausserhalb dieses Epics werden hier nicht gezeigt.
        </p>
      )}
      <div className="h-[480px] rounded-lg border bg-muted/30">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default BreakdownNetworkView;
