"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil, Plus } from "lucide-react";
import dagre from "@dagrejs/dagre";
import { toPng } from "html-to-image";
import {
  ReactFlow,
  Background,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  addEdge,
  getNodesBounds,
  getSmoothStepPath,
  getViewportForBounds,
  useReactFlow,
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
  changeDependencyTypeAction,
} from "@/features/dependencies/actions/dependency";
import { updateFeatureAction } from "@/features/art/actions/feature";
import { saveBreakdownLayoutAction } from "@/features/portfolio/actions/breakdown-layout";
import { useBreakdownRealtime } from "@/features/portfolio/hooks/use-breakdown-realtime";
import { WsjfScoreDialog } from "@/features/art/components/wsjf-score-dialog";
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
  type BreakdownGhostNode,
  type BreakdownGraphEdge,
  type BreakdownGraphNode,
  type DependencyEdgeType,
} from "@/server/views/breakdown-network-view";

interface Props {
  epicId: string;
  /** Tenant-Id — fuer den Realtime-Channel (Roadmap-P8). */
  tenantId: string;
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
    wsjfBusinessValue: number | null;
    wsjfTimeCriticality: number | null;
    wsjfRiskReduction: number | null;
    wsjfJobSize: number | null;
    /** PI-Zuordnung. null = Backlog. Treibt den PI-Mode-Layout (P9). */
    piId: string | null;
  }>;
  /** Distinkte PIs aus dem Scope dieses Epics, sortiert nach startDate
   *  aufsteigend. Treibt die Spalten im PI-Bahnen-Mode (Roadmap-P9). */
  pis: ReadonlyArray<{ id: string; name: string; startDate: string }>;
  dependencies: ReadonlyArray<{
    id: string;
    fromId: string;
    toId: string;
    type: string;
    from?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
    to?: { id: string; title: string; parent: { id: string; title: string } | null } | null;
  }>;
  canLinkDependency: boolean;
  /** Wenn `true`, sind die Plus-Buttons am Node + Edge sichtbar (N3). */
  canCreateFeature: boolean;
  /** Persistierte Node-Positionen (Roadmap-P5). Knoten ohne Eintrag
   *  fallen auf dagre-Auto-Layout zurueck. */
  savedPositions?: Record<string, { x: number; y: number }>;
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
type QuickEditSubmit = (input: { title: string; featureType: "feature" | "enabler" | "" }) => void;

interface FeatureNodeData extends BreakdownGraphNode {
  connectable: boolean;
  showPlus: boolean;
  onAdd?: QuickAddSubmit | undefined;
  showEdit: boolean;
  onEdit?: QuickEditSubmit | undefined;
  artId: string;
}

type EdgeTypeChange = (next: DependencyEdgeType) => void;

interface InsertableEdgeData {
  type: DependencyEdgeType;
  showPlus: boolean;
  onInsert?: QuickAddSubmit | undefined;
  /** Wenn vorhanden, wird das Edge-Label klickbar und oeffnet einen Type-Picker. */
  onChangeType?: EdgeTypeChange | undefined;
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

function QuickEditPopover({
  node,
  onSubmit,
}: {
  node: FeatureNodeData;
  onSubmit: QuickEditSubmit;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [featureType, setFeatureType] = useState<"feature" | "enabler" | "">(
    node.featureType === "enabler" ? "enabler" : node.featureType === "feature" ? "feature" : "",
  );

  // sync state, wenn der Server-Refresh neue Werte liefert
  useEffect(() => {
    if (!open) {
      setTitle(node.title);
      setFeatureType(
        node.featureType === "enabler"
          ? "enabler"
          : node.featureType === "feature"
            ? "feature"
            : "",
      );
    }
  }, [open, node.title, node.featureType]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Feature bearbeiten"
            className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-primary hover:text-primary-foreground"
          >
            <Pencil className="size-3" />
          </button>
        }
      />
      <PopoverContent side="bottom" align="end" className="w-64">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = title.trim();
            if (next.length === 0) return;
            onSubmit({ title: next, featureType });
            setOpen(false);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`edit-title-${node.id}`} className="text-xs">
              Titel
            </Label>
            <Input
              id={`edit-title-${node.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              maxLength={200}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-type-${node.id}`} className="text-xs">
              Typ
            </Label>
            <select
              id={`edit-type-${node.id}`}
              value={featureType}
              onChange={(e) => setFeatureType(e.target.value as "feature" | "enabler" | "")}
              className="flex h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
            >
              <option value="">— ungesetzt</option>
              <option value="feature">Feature</option>
              <option value="enabler">Enabler</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <WsjfScoreDialog
              featureId={node.id}
              artId={node.artId}
              current={node.wsjf}
              renderTrigger={({ onClick }) => (
                <Button type="button" variant="outline" size="sm" onClick={onClick}>
                  WSJF verfeinern
                </Button>
              )}
            />
            <div className="ml-auto flex gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" size="sm">
                Speichern
              </Button>
            </div>
          </div>
        </form>
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
      {node.showEdit && node.onEdit && <QuickEditPopover node={node} onSubmit={node.onEdit} />}
    </div>
  );
}

function EdgeTypePopover({
  children,
  currentType,
  onChange,
}: {
  children: ReactNode;
  currentType: DependencyEdgeType;
  onChange: EdgeTypeChange;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children as React.ReactElement} />
      <PopoverContent side="bottom" align="center" className="w-48">
        <p className="px-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Abhängigkeitstyp
        </p>
        <div className="flex flex-col gap-0.5">
          {(["depends_on", "blocks", "relates_to"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                t === currentType ? "bg-muted font-medium" : "hover:bg-muted/50"
              }`}
              onClick={() => {
                if (t !== currentType) onChange(t);
                setOpen(false);
              }}
            >
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ backgroundColor: EDGE_COLOR[t] }}
                aria-hidden
              />
              <span>{EDGE_LABEL[t]}</span>
              {t === currentType && (
                <span className="ml-auto text-[10px] text-muted-foreground">aktiv</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
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
          {label &&
            (edgeData?.onChangeType ? (
              <EdgeTypePopover currentType={type} onChange={edgeData.onChangeType}>
                <button
                  type="button"
                  aria-label="Abhängigkeitstyp ändern"
                  className="rounded bg-white px-1 text-[10px] transition-colors hover:bg-muted"
                  style={{ color: EDGE_COLOR[type] }}
                >
                  {label}
                </button>
              </EdgeTypePopover>
            ) : (
              <span
                className="rounded bg-white px-1 text-[10px]"
                style={{ color: EDGE_COLOR[type] }}
              >
                {label}
              </span>
            ))}
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

type GhostNodeData = BreakdownGhostNode;

function GhostNode({ data }: NodeProps) {
  const node = data as unknown as GhostNodeData;
  const href = `/umsetzung/feature/${node.id}` as never;
  return (
    <div className="relative" style={{ width: NODE_WIDTH }}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!size-0 !border-none"
      />
      <Link
        href={href}
        className="block rounded-lg border border-dashed border-muted-foreground/40 bg-card/60 p-3 text-left text-xs no-underline opacity-70 shadow-sm transition-colors hover:bg-muted/40 hover:opacity-100"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
          <span className="line-clamp-2 flex-1 text-[13px] font-medium leading-tight text-muted-foreground">
            {node.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full bg-muted px-1.5 py-0.5">
            {node.role === "predecessor" ? "Predecessor extern" : "Successor extern"}
          </span>
          {node.epicTitle && <span className="ml-auto truncate">{node.epicTitle}</span>}
        </div>
      </Link>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!size-0 !border-none"
      />
    </div>
  );
}

function PiHeaderNode({ data }: NodeProps) {
  const node = data as unknown as { label: string };
  return (
    <div
      className="rounded-md bg-muted/60 px-3 py-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
      style={{ width: NODE_WIDTH }}
    >
      {node.label}
    </div>
  );
}

const NODE_TYPES = { feature: FeatureNode, ghost: GhostNode, "pi-header": PiHeaderNode };
const EDGE_TYPES = { insertable: InsertableEdge };

/**
 * Netzplan-PNG-Export (Roadmap-P7). Snapshot der gesamten Canvas in
 * 1600×900 px mit fit-to-bounds-Viewport — independent von Pan/Zoom-
 * Stand. Nutzt `useReactFlow` (muss daher INNERHALB von `<ReactFlow>`
 * gerendert werden, idealerweise im `<Panel>`).
 */
function ExportButton({ epicTitle }: { epicTitle: string }) {
  const { getNodes } = useReactFlow();
  const onExport = async () => {
    const nodes = getNodes();
    if (nodes.length === 0) {
      toast.error("Keine Knoten zum Exportieren");
      return;
    }
    const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewportEl) {
      toast.error("Canvas nicht bereit");
      return;
    }
    const PADDING = 0.1;
    const WIDTH = 1600;
    const HEIGHT = 900;
    const bounds = getNodesBounds(nodes);
    const vp = getViewportForBounds(bounds, WIDTH, HEIGHT, 0.25, 2, PADDING);
    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#ffffff",
        width: WIDTH,
        height: HEIGHT,
        pixelRatio: 2,
        style: {
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        },
      });
      const slug = epicTitle
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const link = document.createElement("a");
      link.download = `netzplan-${slug || "epic"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Netzplan exportiert");
    } catch {
      toast.error("Export fehlgeschlagen");
    }
  };

  return (
    <button
      type="button"
      onClick={onExport}
      title="Netzplan als PNG exportieren"
      aria-label="Netzplan exportieren"
      className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] shadow-sm transition hover:bg-muted"
    >
      <Download className="size-3.5" />
      <span>Export PNG</span>
    </button>
  );
}

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
  ghostNodes: BreakdownGhostNode[],
  artById: Map<string, string>,
  ctx: {
    canLinkDependency: boolean;
    canCreateFeature: boolean;
    canEditFeature: boolean;
    /** Persistierte Positionen — Knoten ohne Eintrag bleiben dagre-gelayoutet. */
    savedPositions?: Record<string, { x: number; y: number }> | undefined;
    onAddSuccessor: (predecessorId: string, predecessorArtId: string) => QuickAddSubmit;
    onEditFeature: (featureId: string, featureArtId: string) => QuickEditSubmit;
    onInsertOnEdge: (
      fromId: string,
      toId: string,
      edgeType: DependencyEdgeType,
      sourceArtId: string,
    ) => QuickAddSubmit;
    onChangeEdgeType: (
      fromId: string,
      toId: string,
      currentType: DependencyEdgeType,
      sourceArtId: string,
    ) => EdgeTypeChange;
  },
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80 });

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
      onAdd: artId !== "" ? ctx.onAddSuccessor(n.id, artId) : undefined,
      showEdit: ctx.canEditFeature && artId !== "",
      onEdit: artId !== "" ? ctx.onEditFeature(n.id, artId) : undefined,
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
      onInsert:
        sourceArtId !== ""
          ? ctx.onInsertOnEdge(e.source, e.target, e.type, sourceArtId)
          : undefined,
      onChangeType:
        ctx.canLinkDependency && sourceArtId !== ""
          ? ctx.onChangeEdgeType(e.source, e.target, e.type, sourceArtId)
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

/**
 * PI-Bahnen-Layout (Roadmap-P9). Spalten:
 *   [Backlog, PI_1, PI_2, …, PI_n, Extern]
 * Knoten stapeln innerhalb ihrer Spalte; Ghost-Knoten landen in
 * "Extern" rechts. Pro Spalte ein Header-Node mit dem PI-Namen oben.
 *
 * Edges sind unveraendert — ReactFlow zeichnet Verbindungen quer
 * ueber die Spalten ohne Zutun.
 */
function layoutByPi(
  nodes: BreakdownGraphNode[],
  edges: BreakdownGraphEdge[],
  ghostNodes: BreakdownGhostNode[],
  pis: ReadonlyArray<{ id: string; name: string; startDate: string }>,
  artById: Map<string, string>,
  ctx: {
    canLinkDependency: boolean;
    canCreateFeature: boolean;
    canEditFeature: boolean;
    onAddSuccessor: (predecessorId: string, predecessorArtId: string) => QuickAddSubmit;
    onEditFeature: (featureId: string, featureArtId: string) => QuickEditSubmit;
    onInsertOnEdge: (
      fromId: string,
      toId: string,
      edgeType: DependencyEdgeType,
      sourceArtId: string,
    ) => QuickAddSubmit;
    onChangeEdgeType: (
      fromId: string,
      toId: string,
      currentType: DependencyEdgeType,
      sourceArtId: string,
    ) => EdgeTypeChange;
  },
): { nodes: Node[]; edges: Edge[] } {
  const COL_WIDTH = NODE_WIDTH + 80;
  const HEADER_HEIGHT = 40;
  const ROW_GAP = 24;
  const FIRST_ROW_Y = HEADER_HEIGHT + 16;

  // Spalten-Index: 0 = Backlog, 1..n = PIs in startDate-Reihenfolge, n+1 = Extern.
  const colByPi = new Map<string, number>();
  pis.forEach((p, i) => colByPi.set(p.id, i + 1));
  const externCol = pis.length + 1;

  // Buckets per Spalten-Index.
  const buckets = new Map<number, { feature?: BreakdownGraphNode; ghost?: BreakdownGhostNode }[]>();
  for (let i = 0; i <= externCol; i++) buckets.set(i, []);

  for (const n of nodes) {
    const col = n.piId == null ? 0 : (colByPi.get(n.piId) ?? 0);
    buckets.get(col)!.push({ feature: n });
  }
  for (const gn of ghostNodes) {
    buckets.get(externCol)!.push({ ghost: gn });
  }

  const rfNodes: Node[] = [];

  // Header-Nodes pro Spalte.
  const headerLabels: Record<number, string> = { 0: "Backlog", [externCol]: "Cross-Epic" };
  for (const p of pis) headerLabels[colByPi.get(p.id)!] = p.name;
  for (let col = 0; col <= externCol; col++) {
    const label = headerLabels[col] ?? "—";
    rfNodes.push({
      id: `pi-header-${col}`,
      type: "pi-header",
      data: { label } as unknown as Record<string, unknown>,
      position: { x: col * COL_WIDTH, y: 0 },
      draggable: false,
      selectable: false,
    });
  }

  // Feature-Knoten + Ghost-Knoten in ihrer Spalte stapeln.
  for (const [col, items] of buckets) {
    items.forEach((item, idx) => {
      const x = col * COL_WIDTH;
      const y = FIRST_ROW_Y + idx * (NODE_HEIGHT + ROW_GAP);
      if (item.feature) {
        const n = item.feature;
        const artId = artById.get(n.id) ?? "";
        const data: FeatureNodeData = {
          ...n,
          artId,
          connectable: ctx.canLinkDependency,
          showPlus: ctx.canCreateFeature && artId !== "",
          onAdd: artId !== "" ? ctx.onAddSuccessor(n.id, artId) : undefined,
          showEdit: ctx.canEditFeature && artId !== "",
          onEdit: artId !== "" ? ctx.onEditFeature(n.id, artId) : undefined,
        };
        rfNodes.push({
          id: n.id,
          type: "feature",
          data: data as unknown as Record<string, unknown>,
          position: { x, y },
        });
      } else if (item.ghost) {
        rfNodes.push({
          id: item.ghost.id,
          type: "ghost",
          data: item.ghost as unknown as Record<string, unknown>,
          position: { x, y },
          draggable: false,
          selectable: true,
        });
      }
    });
  }

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
      onChangeType:
        ctx.canLinkDependency && sourceArtId !== ""
          ? ctx.onChangeEdgeType(e.source, e.target, e.type, sourceArtId)
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
  tenantId,
  epicTitle,
  features,
  pis,
  dependencies,
  canLinkDependency,
  canCreateFeature,
  savedPositions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Realtime-Sync (Roadmap-P8): Supabase-Postgres-Changes auf
  // initiatives + dependencies refreshen die Page debounced 300 ms.
  useBreakdownRealtime(tenantId);

  // ----- Filter (Roadmap-P4) -----
  // Volltextsuche + Typ-Facette. URL-state ?breakdownQ=, ?breakdownType=
  // Search-Input ist lokal-debounced (200 ms) damit URL nicht pro Tastenanschlag flackert.
  const urlQuery = searchParams.get("breakdownQ") ?? "";
  const urlType = (() => {
    const t = searchParams.get("breakdownType");
    return t === "feature" || t === "enabler" ? t : "all";
  })();
  const [queryDraft, setQueryDraft] = useState(urlQuery);
  useEffect(() => setQueryDraft(urlQuery), [urlQuery]);
  useEffect(() => {
    if (queryDraft === urlQuery) return;
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (queryDraft.trim() === "") params.delete("breakdownQ");
      else params.set("breakdownQ", queryDraft.trim());
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
    }, 200);
    return () => window.clearTimeout(t);
  }, [queryDraft, urlQuery, pathname, router, searchParams]);

  const setUrlType = (next: "all" | "feature" | "enabler") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("breakdownType");
    else params.set("breakdownType", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  // Layout-Mode (Roadmap-P9): topology = dagre, pi = swimlanes.
  const layoutMode: "topology" | "pi" =
    searchParams.get("breakdownLayout") === "pi" ? "pi" : "topology";
  const setLayoutMode = (next: "topology" | "pi") => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "topology") params.delete("breakdownLayout");
    else params.set("breakdownLayout", next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

  const hasFilter = urlQuery !== "" || urlType !== "all";
  const matchedIds = useMemo<Set<string> | null>(() => {
    if (!hasFilter) return null;
    const q = urlQuery.toLowerCase().trim();
    const out = new Set<string>();
    for (const f of features) {
      if (urlType !== "all" && f.featureType !== urlType) continue;
      if (q !== "" && !f.title.toLowerCase().includes(q)) continue;
      out.add(f.id);
    }
    return out;
  }, [features, urlQuery, urlType, hasFilter]);

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("breakdownQ");
    params.delete("breakdownType");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
  };

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

  const onEditFeature = useCallback(
    (featureId: string, featureArtId: string): QuickEditSubmit =>
      (input) => {
        const fd = new FormData();
        fd.set("id", featureId);
        fd.set("artId", featureArtId);
        fd.set("title", input.title);
        // Empty string = explicit clear; "feature"/"enabler" set; pass-through.
        fd.set("featureType", input.featureType);
        startTransition(async () => {
          const result = await updateFeatureAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Feature aktualisiert");
          router.refresh();
        });
      },
    [router],
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

  const onChangeEdgeType = useCallback(
    (
      fromId: string,
      toId: string,
      currentType: DependencyEdgeType,
      sourceArtId: string,
    ): EdgeTypeChange =>
      (next) => {
        if (next === currentType) return;
        // Optimistic: lokal sofort den Edge-Style umschreiben.
        setEdges((current) =>
          current.map((edge) => {
            if (edge.source !== fromId || edge.target !== toId) return edge;
            const s = edgeStyle(next);
            const data = edge.data as InsertableEdgeData | undefined;
            return {
              ...edge,
              animated: s.animated,
              style: s.style,
              label: EDGE_LABEL[next],
              markerEnd: s.marker,
              data: {
                ...(data ?? { type: next, showPlus: false }),
                type: next,
              } as unknown as Record<string, unknown>,
            };
          }),
        );
        const fd = new FormData();
        fd.set("fromId", fromId);
        fd.set("toId", toId);
        fd.set("fromType", currentType);
        fd.set("toType", next);
        fd.set("artId", sourceArtId);
        startTransition(async () => {
          const result = await changeDependencyTypeAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            // Rollback: einfach refresh — der Server-Stand ist die Wahrheit.
            router.refresh();
            return;
          }
          toast.success("Abhängigkeitstyp geändert");
          router.refresh();
        });
      },
    [router],
  );

  // Node-Drag-Persistenz (Roadmap-P5). Pro Knoten debounced 400 ms —
  // mehrere Wiggles werden zu einem save zusammengezogen.
  const dragSaveTimers = useMemo<Map<string, ReturnType<typeof setTimeout>>>(() => new Map(), []);
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (!canCreateFeature) return;
      const existing = dragSaveTimers.get(node.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        dragSaveTimers.delete(node.id);
        const fd = new FormData();
        fd.set("epicId", epicId);
        fd.set(
          "positions",
          JSON.stringify([{ initiativeId: node.id, x: node.position.x, y: node.position.y }]),
        );
        startTransition(async () => {
          const result = await saveBreakdownLayoutAction({}, fd);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
        });
      }, 400);
      dragSaveTimers.set(node.id, timer);
    },
    [canCreateFeature, epicId, dragSaveTimers],
  );

  const baseGraph = useMemo(() => {
    const ctx = {
      canLinkDependency,
      canCreateFeature,
      canEditFeature: canCreateFeature,
      onAddSuccessor,
      onEditFeature,
      onInsertOnEdge,
      onChangeEdgeType,
    };
    if (layoutMode === "pi") {
      return layoutByPi(model.nodes, model.edges, model.ghostNodes, pis, artById, ctx);
    }
    return layoutGraph(model.nodes, model.edges, model.ghostNodes, artById, {
      ...ctx,
      savedPositions,
    });
  }, [
    layoutMode,
    model.nodes,
    model.edges,
    model.ghostNodes,
    pis,
    artById,
    canLinkDependency,
    canCreateFeature,
    savedPositions,
    onAddSuccessor,
    onEditFeature,
    onInsertOnEdge,
    onChangeEdgeType,
  ]);

  // Controlled-Edges fuer Optimistic Drag-Connect.
  const [edges, setEdges] = useState<Edge[]>(baseGraph.edges);
  useEffect(() => setEdges(baseGraph.edges), [baseGraph.edges]);

  // Filter-Overlay (Roadmap-P4): nicht-gematchte Nodes + Edges, die nicht
  // beide endpunkte gematcht haben, werden auf opacity 0.25 dimmed.
  const displayNodes = useMemo(() => {
    if (!matchedIds) return baseGraph.nodes;
    return baseGraph.nodes.map((n) =>
      matchedIds.has(n.id) ? n : { ...n, style: { ...(n.style ?? {}), opacity: 0.25 } },
    );
  }, [baseGraph.nodes, matchedIds]);
  const displayEdges = useMemo(() => {
    if (!matchedIds) return edges;
    return edges.map((e) => {
      const matchedEdge = matchedIds.has(e.source) && matchedIds.has(e.target);
      if (matchedEdge) return e;
      return { ...e, style: { ...(e.style ?? {}), opacity: 0.25 } };
    });
  }, [edges, matchedIds]);

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
          ungültigem Typ ignoriert.
        </p>
      )}
      {model.ghostNodes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {model.ghostNodes.length} Cross-Epic-Endpunkt
          {model.ghostNodes.length === 1 ? "" : "e"} (gestrichelt) — Klick navigiert zum externen
          Feature.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Input
          value={queryDraft}
          onChange={(e) => setQueryDraft(e.target.value)}
          placeholder="Suche im Titel…"
          aria-label="Suche im Netzplan"
          className="h-7 w-48 text-xs"
        />
        <div
          role="radiogroup"
          aria-label="Typ-Filter"
          className="inline-flex overflow-hidden rounded-md border bg-card"
        >
          {(["all", "feature", "enabler"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={urlType === t}
              onClick={() => setUrlType(t)}
              className={`px-2 py-0.5 ${
                urlType === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t === "all" ? "Alle Typen" : t === "feature" ? "Feature" : "Enabler"}
            </button>
          ))}
        </div>
        {hasFilter && (
          <>
            <span className="text-muted-foreground">
              {matchedIds?.size ?? 0} von {features.length} sichtbar
            </span>
            <button type="button" onClick={clearFilter} className="text-primary hover:underline">
              Filter zurücksetzen
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Layout:</span>
          <div
            role="radiogroup"
            aria-label="Layout-Modus"
            className="inline-flex overflow-hidden rounded-md border bg-card"
          >
            {(["topology", "pi"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={layoutMode === m}
                onClick={() => setLayoutMode(m)}
                className={`px-2 py-0.5 ${
                  layoutMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {m === "topology" ? "Topologie" : "PI-Bahnen"}
              </button>
            ))}
          </div>
        </div>
      </div>
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
          nodes={displayNodes}
          edges={displayEdges}
          {...(layoutMode === "topology" ? { onNodeDragStop } : {})}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={layoutMode === "topology"}
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
          <Panel position="top-right">
            <ExportButton epicTitle={epicTitle} />
          </Panel>
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
