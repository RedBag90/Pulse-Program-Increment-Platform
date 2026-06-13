"use client";

import { memo, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  Background,
  ReactFlow,
  type Edge,
  type Node,
  MarkerType,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  CockpitDependency,
  CockpitFeature,
  FeatureStatus,
} from "@/server/views/umsetzung-cockpit-view";

/**
 * Netzplan-Sicht des Cockpits — flacher Network-Graph aller Features
 * im ART-Scope, Dependencies als gerichtete Kanten. Spiegelt das
 * Epic-Breakdown-Pattern, ist aber bewusst **slim**: nur Visualisierung,
 * kein Quick-Add, kein Refine, kein Position-Persist, kein Drag-Connect.
 * Edits laufen ueber den Feature-Slide-Over (Klick auf Knoten).
 *
 * Off-Scope-Endpunkte erscheinen als gestrichelte Ghost-Nodes am Rand
 * des Layouts — gleiche Sprache wie im Epic-Breakdown.
 */
interface Props {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
}

const NODE_W = 200;
const NODE_H = 64;

const EDGE_COLOR: Record<CockpitDependency["type"], string> = {
  blocks: "#ef4444",
  depends_on: "#d97706",
  relates_to: "#94a3b8",
};

const STATUS_DOT: Record<FeatureStatus, string> = {
  approved: "bg-sky-500",
  in_progress: "bg-indigo-500",
  blocked: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

const STATUS_LABEL: Record<FeatureStatus, string> = {
  approved: "Bereit",
  in_progress: "In Umsetzung",
  blocked: "Blockiert",
  completed: "Fertig",
  cancelled: "Abgebrochen",
};

type FeatureNodeData = {
  feature: CockpitFeature;
  onOpen: (id: string) => void;
};

type GhostNodeData = {
  title: string;
  hint: string;
};

const FeatureNode = memo(function FeatureNode({ data }: { data: FeatureNodeData }) {
  const f = data.feature;
  return (
    <button
      type="button"
      onClick={() => data.onOpen(f.id)}
      className="flex h-[64px] w-[200px] flex-col gap-1 rounded-md border bg-card px-2.5 py-1.5
        text-left shadow-sm transition-shadow hover:shadow-md"
      title={f.title}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[f.status]}`} />
        <span className="line-clamp-2 text-[12px] font-medium leading-tight">{f.title}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="truncate">{STATUS_LABEL[f.status]}</span>
        {f.wsjfComputed != null && (
          <span className="shrink-0 font-medium">WSJF {Math.round(f.wsjfComputed)}</span>
        )}
      </div>
    </button>
  );
});

const GhostNode = memo(function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <div
      className="flex h-[64px] w-[200px] flex-col justify-center gap-0.5 rounded-md border
        border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-left
        text-muted-foreground"
      title={`${data.hint}: ${data.title}`}
    >
      <span className="text-[10px] uppercase tracking-wide">{data.hint}</span>
      <span className="line-clamp-2 text-[12px] font-medium leading-tight">{data.title}</span>
    </div>
  );
});

const NODE_TYPES = {
  feature: FeatureNode,
  ghost: GhostNode,
};

export function CockpitNetwork({ features, dependencies }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openSlideOver(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("featureId", id);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  // openSlideOver wird pro Render neu erzeugt — das ist beabsichtigt,
  // damit der Klick immer den aktuellen searchParams-Stand mitnimmt.
  // dagre.layout ist der Hotspot, das Closure-Refresh ist billig.
  const searchParamsKey = searchParams.toString();
  const { nodes, edges } = useMemo(
    () => buildLayoutedGraph(features, dependencies, openSlideOver),
    [features, dependencies, searchParamsKey, openSlideOver],
  );

  if (features.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Keine Features im Scope.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-260px)] min-h-[400px] overflow-hidden rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

function buildLayoutedGraph(
  features: CockpitFeature[],
  dependencies: CockpitDependency[],
  onOpen: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const featureIds = new Set(features.map((f) => f.id));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 80 });

  for (const f of features) {
    g.setNode(f.id, { width: NODE_W, height: NODE_H });
  }

  // Ghost-Knoten fuer Off-Scope-Endpunkte. Ein Ghost je
  // (richtung × off-scope-feature-id) — kein Duplikat wenn mehrere
  // Edges denselben externen Knoten treffen.
  const ghostIds = new Map<string, { title: string; hint: string }>();

  for (const d of dependencies) {
    if (d.offScopeRole === "from") {
      const ghostId = `ghost:from:${d.fromId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Predecessor (off-scope)",
        });
        g.setNode(ghostId, { width: NODE_W, height: NODE_H });
      }
      if (featureIds.has(d.toId)) g.setEdge(ghostId, d.toId);
    } else if (d.offScopeRole === "to") {
      const ghostId = `ghost:to:${d.toId}`;
      if (!ghostIds.has(ghostId)) {
        ghostIds.set(ghostId, {
          title: d.offScopeLabel ?? "Externer Knoten",
          hint: "Successor (off-scope)",
        });
        g.setNode(ghostId, { width: NODE_W, height: NODE_H });
      }
      if (featureIds.has(d.fromId)) g.setEdge(d.fromId, ghostId);
    } else if (featureIds.has(d.fromId) && featureIds.has(d.toId)) {
      g.setEdge(d.fromId, d.toId);
    }
  }

  dagre.layout(g);

  const nodes: Node[] = [];
  for (const f of features) {
    const pos = g.node(f.id);
    nodes.push({
      id: f.id,
      type: "feature",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: { feature: f, onOpen } satisfies FeatureNodeData,
    });
  }
  for (const [ghostId, info] of ghostIds) {
    const pos = g.node(ghostId);
    nodes.push({
      id: ghostId,
      type: "ghost",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: info satisfies GhostNodeData,
    });
  }

  const edges: Edge[] = [];
  for (const d of dependencies) {
    let source: string;
    let target: string;
    if (d.offScopeRole === "from") {
      source = `ghost:from:${d.fromId}`;
      target = d.toId;
    } else if (d.offScopeRole === "to") {
      source = d.fromId;
      target = `ghost:to:${d.toId}`;
    } else {
      source = d.fromId;
      target = d.toId;
    }
    edges.push({
      id: d.id,
      source,
      target,
      type: "smoothstep",
      animated: d.type === "blocks",
      style: {
        stroke: EDGE_COLOR[d.type],
        strokeWidth: 1.5,
        strokeDasharray: d.type === "relates_to" ? "4 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR[d.type] },
    });
  }

  return { nodes, edges };
}
