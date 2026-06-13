"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import dagre from "@dagrejs/dagre";
import {
  ReactFlow,
  Background,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  addEdge,
  getSmoothStepPath,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { detectCycle } from "@/domain/dependency-graph";
import { CreateFeatureDialog } from "@/features/art/components/create-feature-dialog";
import {
  linkDependencyAction,
  unlinkDependencyAction,
} from "@/features/dependencies/actions/dependency";
import {
  quickAddFeatureWithDependencyAction,
  insertFeatureBetweenAction,
} from "@/features/portfolio/actions/breakdown-network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildBreakdownGraph,
  type BreakdownGraphEdge,
  type BreakdownGraphNode,
  type DependencyEdgeType,
} from "@/server/views/breakdown-network-view";

interface Props {
  epicId: string;
  /** Epic-Titel — wird in der Empty-State-CTA als Parent-Epic-Label genutzt. */
  epicTitle: string;
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
  /** Wenn `true`, sind die Plus-Buttons am Node + Edge sichtbar (N3). */
  canCreateFeature: boolean;
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

type QuickAddSubmit = (input: { title: string; featureType: "feature" | "enabler" }) => void;

interface FeatureNodeData extends BreakdownGraphNode {
  connectable: boolean;
  showPlus: boolean;
  onAdd?: QuickAddSubmit | undefined;
  artId: string;
}

interface InsertableEdgeData {
  type: DependencyEdgeType;
  showPlus: boolean;
  onInsert?: QuickAddSubmit | undefined;
}

function QuickAddForm({
  defaultTitle,
  onSubmit,
  onClose,
  busy,
}: {
  defaultTitle?: string;
  onSubmit: (input: { title: string; featureType: "feature" | "enabler" }) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [featureType, setFeatureType] = useState<"feature" | "enabler">("feature");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length === 0) return;
        onSubmit({ title: title.trim(), featureType });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="quick-add-title" className="text-xs">
          Titel
        </Label>
        <Input
          id="quick-add-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={200}
          placeholder="z. B. Auth-Refresh-Endpoint"
          className="h-8"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quick-add-type" className="text-xs">
          Typ
        </Label>
        <select
          id="quick-add-type"
          value={featureType}
          onChange={(e) => setFeatureType(e.target.value as "feature" | "enabler")}
          className="flex h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
        >
          <option value="feature">Feature</option>
          <option value="enabler">Enabler</option>
        </select>
      </div>
      <p className="text-[10px] text-muted-foreground">
        WSJF wird auf 3/3/3/3 vorbelegt — verfeinerst du im Detail-Tab.
      </p>
      <div className="flex justify-end gap-1.5 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={busy || title.trim().length === 0}>
          {busy ? "Anlegen…" : "Anlegen"}
        </Button>
      </div>
    </form>
  );
}

function QuickAddPopover({
  children,
  onSubmit,
  busy,
}: {
  children: ReactNode;
  onSubmit: QuickAddSubmit;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent side="bottom" align="center" className="w-64">
        <QuickAddForm
          onSubmit={(input) => {
            onSubmit(input);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          busy={busy}
        />
      </PopoverContent>
    </Popover>
  );
}

function FeatureNode({ data }: NodeProps) {
  const node = data as unknown as FeatureNodeData;
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
      {node.showPlus && node.onAdd && (
        <div className="absolute -right-7 top-1/2 -translate-y-1/2">
          <QuickAddPopover onSubmit={node.onAdd} busy={false}>
            <button
              type="button"
              aria-label="Folge-Feature anlegen"
              className="flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="size-3" />
            </button>
          </QuickAddPopover>
        </div>
      )}
    </div>
  );
}

function InsertableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    label,
    markerEnd,
    style,
  } = props;
  const edgeData = data as unknown as InsertableEdgeData | undefined;
  const type = edgeData?.type ?? "depends_on";
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <path
        id={id}
        d={edgePath}
        style={style}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        fill="none"
      />
      <EdgeLabelRenderer>
        <div
          className="absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
        >
          {label && (
            <span className="rounded bg-white px-1 text-[10px]" style={{ color: EDGE_COLOR[type] }}>
              {label}
            </span>
          )}
          {edgeData?.showPlus && edgeData.onInsert && (
            <QuickAddPopover onSubmit={edgeData.onInsert} busy={false}>
              <button
                type="button"
                aria-label="Feature zwischenfügen"
                className="flex size-5 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="size-3" />
              </button>
            </QuickAddPopover>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { feature: FeatureNode };
const EDGE_TYPES = { insertable: InsertableEdge };

function edgeStyle(type: DependencyEdgeType): {
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

function layoutGraph(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
  artById: Map<string, string>,
  ctx: {
    canLinkDependency: boolean;
    canCreateFeature: boolean;
    onAddSuccessor: (predecessorId: string, predecessorArtId: string) => QuickAddSubmit;
    onInsertOnEdge: (
      fromId: string,
      toId: string,
      edgeType: DependencyEdgeType,
      sourceArtId: string,
    ) => QuickAddSubmit;
  },
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
    const artId = artById.get(n.id) ?? "";
    const data: FeatureNodeData = {
      ...n,
      artId,
      connectable: ctx.canLinkDependency,
      showPlus: ctx.canCreateFeature && artId !== "",
      onAdd: artId !== "" ? ctx.onAddSuccessor(n.id, artId) : undefined,
    };
    return {
      id: n.id,
      type: "feature",
      data: data as unknown as Record<string, unknown>,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  const rfEdges: Edge[] = edges.map((e) => {
    const s = edgeStyle(e.type);
    const sourceArtId = artById.get(e.source) ?? "";
    const data: InsertableEdgeData = {
      type: e.type,
      showPlus: ctx.canCreateFeature && sourceArtId !== "",
      onInsert:
        sourceArtId !== ""
          ? ctx.onInsertOnEdge(e.source, e.target, e.type, sourceArtId)
          : undefined,
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

export function BreakdownNetworkView({
  epicId,
  epicTitle,
  features,
  dependencies,
  canLinkDependency,
  canCreateFeature,
}: Props) {
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

  // onAddSuccessor: bauen pro Render eine factory, die fuer einen
  // Predecessor eine Submit-Funktion liefert. Die Submit-Funktion ruft
  // die Server-Action und tut Optimistic + Refresh.
  const onAddSuccessor = useCallback(
    (predecessorId: string, predecessorArtId: string): QuickAddSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("artId", predecessorArtId);
        fd.set("parentEpicId", epicId);
        fd.set("predecessorId", predecessorId);
        fd.set("title", input.title);
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await quickAddFeatureWithDependencyAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Folge-Feature angelegt");
          router.refresh();
        });
      },
    [epicId, router],
  );

  const onInsertOnEdge = useCallback(
    (
      fromId: string,
      toId: string,
      edgeType: DependencyEdgeType,
      sourceArtId: string,
    ): QuickAddSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("artId", sourceArtId);
        fd.set("parentEpicId", epicId);
        fd.set("fromId", fromId);
        fd.set("toId", toId);
        fd.set("edgeType", edgeType);
        fd.set("title", input.title);
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await insertFeatureBetweenAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Feature zwischengefügt");
          router.refresh();
        });
      },
    [epicId, router],
  );

  const baseGraph = useMemo(
    () =>
      layoutGraph(model.nodes, model.edges, artById, {
        canLinkDependency,
        canCreateFeature,
        onAddSuccessor,
        onInsertOnEdge,
      }),
    [
      model.nodes,
      model.edges,
      artById,
      canLinkDependency,
      canCreateFeature,
      onAddSuccessor,
      onInsertOnEdge,
    ],
  );

  // Controlled-Edges fuer Optimistic Drag-Connect.
  const [edges, setEdges] = useState<Edge[]>(baseGraph.edges);
  useEffect(() => setEdges(baseGraph.edges), [baseGraph.edges]);

  // Connection-Typ steuert, mit welchem Edge-Type neue Drag-Connects
  // angelegt werden. Default `depends_on`.
  const [connectType, setConnectType] = useState<DependencyEdgeType>("depends_on");

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!canLinkDependency) return;
      if (!conn.source || !conn.target) return;
      if (conn.source === conn.target) {
        toast.error("Eine Abhängigkeit auf dasselbe Feature ist nicht möglich.");
        return;
      }
      if (
        connectType !== "relates_to" &&
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
      const s = edgeStyle(connectType);
      const tmpEdge: Edge = {
        id: tmpId,
        source: conn.source,
        target: conn.target,
        type: "insertable",
        label: EDGE_LABEL[connectType],
        animated: s.animated,
        style: s.style,
        markerEnd: s.marker,
        data: {
          type: connectType,
          showPlus: false,
        } as unknown as Record<string, unknown>,
      };
      setEdges((current) => addEdge(tmpEdge, current));

      const fd = new FormData();
      fd.set("fromId", conn.source);
      fd.set("toId", conn.target);
      fd.set("type", connectType);
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
    [artById, canLinkDependency, connectType, edges, router],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (!canLinkDependency) return;
      for (const edge of deleted) {
        if (edge.id.startsWith("tmp-")) continue;
        const sourceArtId = artById.get(edge.source);
        if (!sourceArtId) {
          // Re-Add — ohne ART kein unlink-Call.
          setEdges((current) => addEdge(edge, current));
          toast.error("Source-ART unbekannt — Abhängigkeit nicht gelöscht.");
          continue;
        }
        const data = edge.data as InsertableEdgeData | undefined;
        const type = data?.type ?? "depends_on";
        const fd = new FormData();
        fd.set("fromId", edge.source);
        fd.set("toId", edge.target);
        fd.set("type", type);
        fd.set("artId", sourceArtId);
        startTransition(async () => {
          const result = await unlinkDependencyAction({}, fd);
          if (result?.error) {
            setEdges((current) => addEdge(edge, current));
            toast.error(result.error);
            return;
          }
          toast.success("Abhängigkeit gelöscht");
          router.refresh();
        });
      }
    },
    [artById, canLinkDependency, router],
  );

  if (model.nodes.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <p>
          Noch keine Features in diesem Epic — leg das erste an, dann baust du den Netzplan auf.
        </p>
        {canCreateFeature && (
          <CreateFeatureDialog epics={[{ id: epicId, title: epicTitle }]} context={{ epicId }} />
        )}
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
      {(canLinkDependency || canCreateFeature) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-muted-foreground">
            {canCreateFeature && <>„+" am Node = Folge-Feature · „+" an Edge = dazwischen. </>}
            {canLinkDependency && (
              <>
                Drag von rechts auf links = neue Abhängigkeit · Edge selektieren + Entf = löschen.
              </>
            )}
          </p>
          {canLinkDependency && (
            <div className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Neue Edge:</span>
              <div
                role="radiogroup"
                aria-label="Connection-Typ"
                className="inline-flex overflow-hidden rounded-md border bg-card"
              >
                {(["depends_on", "blocks", "relates_to"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={connectType === t}
                    onClick={() => setConnectType(t)}
                    className={`px-2 py-0.5 ${
                      connectType === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    style={connectType === t ? undefined : { color: EDGE_COLOR[t] }}
                  >
                    {EDGE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="h-[480px] rounded-lg border bg-muted/30">
        <ReactFlow
          nodes={baseGraph.nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable
          edgesFocusable={canLinkDependency}
          edgesReconnectable={false}
          deleteKeyCode={canLinkDependency ? ["Backspace", "Delete"] : null}
          onEdgesDelete={onEdgesDelete}
          nodesConnectable={canLinkDependency}
          elementsSelectable
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            ariaLabel="Netzplan-Übersicht"
            nodeColor={(n) => {
              const d = n.data as unknown as FeatureNodeData | undefined;
              return d?.featureType === "enabler" ? "#a78bfa" : "#60a5fa";
            }}
            nodeStrokeWidth={0}
            maskColor="rgba(0,0,0,0.04)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default BreakdownNetworkView;
