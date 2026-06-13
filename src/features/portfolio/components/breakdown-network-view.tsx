"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { detectCycle } from "@/domain/dependency-graph";
import { linkDependencyAction } from "@/features/dependencies/actions/dependency";
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
    artId: string;
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
  canLinkDependency: boolean;
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
  const node = data as unknown as BreakdownGraphNode & { connectable: boolean };
  const isEnabler = node.featureType === "enabler";
  return (
    <div className="relative" style={{ width: NODE_WIDTH }}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={node.connectable}
        className={
          node.connectable
            ? "!size-2 !border !border-background !bg-foreground/60"
            : "!size-0 !border-none"
        }
      />
      <Link
        href={`/umsetzung/feature/${node.id}` as never}
        className="block rounded-lg border border-border bg-card p-3 text-left text-xs no-underline shadow-sm transition-colors hover:bg-muted/40"
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
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={node.connectable}
        className={
          node.connectable
            ? "!size-2 !border !border-background !bg-foreground/60"
            : "!size-0 !border-none"
        }
      />
    </div>
  );
}

const NODE_TYPES = { feature: FeatureNode };

function edgeStyle(type: DependencyEdgeType): Edge {
  return {
    id: "",
    source: "",
    target: "",
    label: EDGE_LABEL[type],
    type: "smoothstep",
    animated: type === "blocks",
    style: {
      stroke: EDGE_COLOR[type],
      strokeWidth: 1.5,
      strokeDasharray: type === "relates_to" ? "4 4" : undefined,
    },
    labelStyle: { fill: EDGE_COLOR[type], fontSize: 10 },
    labelBgStyle: { fill: "white" },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR[type] },
  };
}

function layoutGraph(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
  connectable: boolean,
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
      data: { ...n, connectable } as unknown as Record<string, unknown>,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  const rfEdges: Edge[] = edges.map((e) => {
    const tmpl = edgeStyle(e.type);
    return { ...tmpl, id: e.id, source: e.source, target: e.target };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

export function BreakdownNetworkView({ features, dependencies, canLinkDependency }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const artById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of features) m.set(f.id, f.artId);
    return m;
  }, [features]);

  const model = useMemo(
    () => buildBreakdownGraph({ features, dependencies }),
    [features, dependencies],
  );
  const baseGraph = useMemo(
    () => layoutGraph(model.nodes, model.edges, canLinkDependency),
    [model.nodes, model.edges, canLinkDependency],
  );

  // Controlled-State auf Edges, damit Connects sofort sichtbar werden;
  // bei Page-Refresh kommt der finale Stand aus dem Server.
  const [edges, setEdges] = useState<Edge[]>(baseGraph.edges);
  useEffect(() => setEdges(baseGraph.edges), [baseGraph.edges]);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!canLinkDependency) return;
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        toast.error("Eine Abhängigkeit auf dasselbe Feature ist nicht möglich.");
        return;
      }
      if (
        detectCycle(
          conn.source,
          conn.target,
          edges.map((e) => ({ fromId: e.source, toId: e.target })),
        )
      ) {
        toast.error("Diese Verbindung würde einen Zyklus erzeugen.");
        return;
      }
      const sourceArtId = artById.get(conn.source);
      if (!sourceArtId) {
        toast.error("Source-ART unbekannt — Abhängigkeit nicht angelegt.");
        return;
      }
      const tmpId = `tmp-${conn.source}-${conn.target}-${Date.now()}`;
      const tmpl = edgeStyle("depends_on");
      setEdges((current) =>
        addEdge({ ...tmpl, id: tmpId, source: conn.source!, target: conn.target! }, current),
      );

      const fd = new FormData();
      fd.set("fromId", conn.source);
      fd.set("toId", conn.target);
      fd.set("type", "depends_on");
      fd.set("artId", sourceArtId);

      startTransition(async () => {
        const result = await linkDependencyAction({}, fd);
        if (result?.error) {
          setEdges((current) => current.filter((e) => e.id !== tmpId));
          toast.error(result.error);
          return;
        }
        toast.success("Abhängigkeit angelegt");
        router.refresh();
      });
    },
    [artById, canLinkDependency, edges, router, startTransition],
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
      {canLinkDependency && (
        <p className="text-xs text-muted-foreground">
          Tipp: Ziehe vom rechten Rand eines Nodes auf den linken Rand eines anderen, um eine neue
          „depends on"-Abhängigkeit anzulegen.
        </p>
      )}
      <div className="h-[480px] rounded-lg border bg-muted/30">
        <ReactFlow
          nodes={baseGraph.nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable
          nodesConnectable={canLinkDependency}
          elementsSelectable
          onConnect={onConnect}
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
