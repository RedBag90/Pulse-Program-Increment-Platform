"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type Connection,
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
import {
  linkDependencyAction,
  unlinkDependencyAction,
  changeDependencyTypeAction,
} from "@/features/dependencies/actions/dependency";
import { EdgeTypeMenu } from "@/features/dependencies/components/edge-type-popover";
import { FeaturePickerPopover } from "@/features/dependencies/components/feature-picker-popover";
import type { DependencyEdgeType } from "@/server/views/breakdown-network-view";

/**
 * Netzplan-Sicht des Cockpits — flacher Network-Graph aller Features
 * im ART-Scope, Dependencies als gerichtete Kanten. Spiegelt das
 * Epic-Breakdown-Pattern; Editing-UX ist konsistent zum Epic-Breakdown:
 * Drag-Connect erzeugt neue Dep, Klick auf Edge oeffnet das gleiche
 * EdgeTypeMenu (Typ wechseln / loeschen). Cross-ART-Endpunkte werden
 * ueber einen + Knopf rechts oben angelegt (Source-Pick, dann
 * FeaturePickerPopover).
 *
 * Off-Scope-Endpunkte erscheinen als gestrichelte Ghost-Nodes am Rand.
 */
interface Props {
  features: CockpitFeature[];
  dependencies: CockpitDependency[];
  artId: string;
  canLinkDependency: boolean;
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
  connectable: boolean;
};

type GhostNodeData = {
  title: string;
  hint: string;
};

/**
 * Style der React-Flow-Handles. `connectable=false` haelt sie komplett
 * versteckt (size-0). `connectable=true` zeigt einen kleinen dot beim
 * Group-Hover — User sieht erst beim Anvisieren des Knotens, wo er
 * ziehen kann.
 */
const HANDLE_HIDDEN = "!size-0 !border-none !bg-transparent";
const HANDLE_VISIBLE =
  "!size-2 !border !border-background !bg-foreground/60 !opacity-0 transition-opacity group-hover:!opacity-100";

const FeatureNode = memo(function FeatureNode({ data }: { data: FeatureNodeData }) {
  const f = data.feature;
  const handleClass = data.connectable ? HANDLE_VISIBLE : HANDLE_HIDDEN;
  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        isConnectable={data.connectable}
      />
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
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        isConnectable={data.connectable}
      />
    </div>
  );
});

const GhostNode = memo(function GhostNode({ data }: { data: GhostNodeData }) {
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />
      <div
        className="flex h-[64px] w-[200px] flex-col justify-center gap-0.5 rounded-md border
          border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1.5 text-left
          text-muted-foreground"
        title={`${data.hint}: ${data.title}`}
      >
        <span className="text-[10px] uppercase tracking-wide">{data.hint}</span>
        <span className="line-clamp-2 text-[12px] font-medium leading-tight">{data.title}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={HANDLE_HIDDEN}
        isConnectable={false}
      />
    </div>
  );
});

const NODE_TYPES = {
  feature: FeatureNode,
  ghost: GhostNode,
};

type EdgeAnchor = { depId: string; type: DependencyEdgeType; x: number; y: number };
type AddState = { sourceId: string; anchorX: number; anchorY: number };

export function CockpitNetwork({ features, dependencies, artId, canLinkDependency }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [edgeAnchor, setEdgeAnchor] = useState<EdgeAnchor | null>(null);
  const [addState, setAddState] = useState<AddState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openSlideOver(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("featureId", id);
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  }

  function depById(depId: string): CockpitDependency | undefined {
    return dependencies.find((d) => d.id === depId);
  }

  function callLink(sourceId: string, targetId: string, type: DependencyEdgeType = "depends_on") {
    if (sourceId === targetId) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fromId", sourceId);
      fd.set("toId", targetId);
      fd.set("type", type);
      fd.set("artId", artId);
      const res = await linkDependencyAction({}, fd);
      setError(res.error ?? null);
    });
  }

  function callUnlink(depId: string) {
    const d = depById(depId);
    if (!d) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fromId", d.fromId);
      fd.set("toId", d.toId);
      fd.set("type", d.type);
      fd.set("artId", artId);
      const res = await unlinkDependencyAction({}, fd);
      setError(res.error ?? null);
    });
  }

  function callChangeType(depId: string, next: DependencyEdgeType) {
    const d = depById(depId);
    if (!d || d.type === next) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("fromId", d.fromId);
      fd.set("toId", d.toId);
      fd.set("fromType", d.type);
      fd.set("toType", next);
      fd.set("artId", artId);
      const res = await changeDependencyTypeAction({}, fd);
      setError(res.error ?? null);
    });
  }

  // openSlideOver wird pro Render neu erzeugt — das ist beabsichtigt,
  // damit der Klick immer den aktuellen searchParams-Stand mitnimmt.
  // dagre.layout ist der Hotspot, das Closure-Refresh ist billig.
  const searchParamsKey = searchParams.toString();
  const { nodes, edges } = useMemo(
    () => buildLayoutedGraph(features, dependencies, openSlideOver, canLinkDependency),
    [features, dependencies, searchParamsKey, openSlideOver, canLinkDependency],
  );

  if (features.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/10">
        <p className="text-sm text-muted-foreground">Keine Features im Scope.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-260px)] min-h-[400px] overflow-hidden rounded-lg border">
      {error && (
        <div className="absolute left-2 top-2 z-30 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
      {canLinkDependency && (
        <button
          type="button"
          onClick={() => setAddState({ sourceId: "", anchorX: 24, anchorY: 64 })}
          className="absolute right-3 top-3 z-20 rounded-md border bg-card px-2.5 py-1 text-xs font-medium shadow-sm hover:bg-muted/40"
          title="Cross-ART-Dependency anlegen"
        >
          + Cross-ART
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={canLinkDependency}
        elementsSelectable
        fitView
        proOptions={{ hideAttribution: true }}
        onConnect={(c: Connection) => {
          if (!canLinkDependency) return;
          if (!c.source || !c.target) return;
          // Drag-Connect von einem Feature-Knoten auf einen anderen.
          // Ghost-Knoten werden bewusst nicht connectable gemacht.
          callLink(c.source, c.target);
        }}
        onEdgeClick={(e, edge) => {
          if (!canLinkDependency) return;
          const d = depById(edge.id);
          if (!d) return;
          e.preventDefault();
          setEdgeAnchor({ depId: d.id, type: d.type, x: e.clientX, y: e.clientY });
        }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {edgeAnchor && (
        <div
          className="fixed z-50"
          style={{ left: edgeAnchor.x, top: edgeAnchor.y }}
          onMouseLeave={() => setEdgeAnchor(null)}
        >
          <EdgeTypeMenu
            currentType={edgeAnchor.type}
            onChange={(t) => callChangeType(edgeAnchor.depId, t)}
            onDelete={() => callUnlink(edgeAnchor.depId)}
            onClose={() => setEdgeAnchor(null)}
          />
        </div>
      )}

      {addState &&
        (addState.sourceId === "" ? (
          <FeaturePickerPopover
            anchorX={addState.anchorX}
            anchorY={addState.anchorY}
            onSelect={(sourceId) =>
              setAddState({ sourceId, anchorX: addState.anchorX, anchorY: addState.anchorY + 80 })
            }
            onCancel={() => setAddState(null)}
            initialQuery=""
          />
        ) : (
          <FeaturePickerPopover
            anchorX={addState.anchorX}
            anchorY={addState.anchorY}
            excludeIds={[addState.sourceId]}
            onSelect={(targetId) => {
              callLink(addState.sourceId, targetId);
              setAddState(null);
            }}
            onCancel={() => setAddState(null)}
            initialQuery=""
          />
        ))}
    </div>
  );
}

function buildLayoutedGraph(
  features: CockpitFeature[],
  dependencies: CockpitDependency[],
  onOpen: (id: string) => void,
  connectable: boolean,
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
      data: { feature: f, onOpen, connectable } satisfies FeatureNodeData,
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
