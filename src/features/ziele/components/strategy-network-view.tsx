"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dagre from "@dagrejs/dagre";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GoalNode } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";
import { goalPeriodLabel } from "@/domain/goal-period";
import { GoalStatusPill } from "@/features/ziele/components/goal-status/goal-status-pill";

/**
 * Strategie als Netzplan — flach (Refactor §Hierarchie-Vereinfachung).
 *
 * Top-Down xyflow + dagre: **Themes** (OKRs) oben, **KRs** darunter.
 * Knoten als Cards mit Title, Progress-Bar, Subgoal-Count, Periode +
 * Owner-Initiale. Klick = Deeplink nach `/ziele?entity=…&id=…`.
 *
 * Read-only — kein Drag-and-Drop, keine Inline-Edits.
 */
interface Props {
  themes: GoalNode[];
}

type Tier = "theme" | "kr";

interface NodeData extends Record<string, unknown> {
  tier: Tier;
  goalId: string;
  title: string;
  status: string | null;
  progress: number;
  subgoalCount: number;
  period: string | null;
  ownerInitial: string;
  atRisk: boolean;
  href: string;
  accent: string;
  /** Hat der Knoten Kinder (Expand/Collapse-Toggle anzeigen)? */
  hasChildren: boolean;
  /** Gesamtzahl Nachfahren (Badge „+N" bei eingeklappt). */
  descendantCount: number;
  /** Teilbaum aktuell eingeklappt? */
  collapsed: boolean;
  onToggle: (goalId: string) => void;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 140;

const HUE_PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export function StrategyNetworkView({ themes }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const onToggle = useCallback((goalId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setCollapsed(collapsibleIds(themes)), [themes]);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const { nodes, edges } = useMemo(
    () => buildGraph(themes, collapsed, onToggle),
    [themes, collapsed, onToggle],
  );

  if (nodes.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
        Noch keine Strategie definiert.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          Alle einklappen
        </button>
        <button
          type="button"
          onClick={expandAll}
          className="rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          Alle ausklappen
        </button>
      </div>
      <div className="h-[680px] overflow-hidden rounded-lg border bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.2}
          maxZoom={1.4}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>
      </div>
    </div>
  );
}

const NODE_TYPES = { strategyNode: StrategyNode };

function StrategyNode({ data }: NodeProps) {
  const d = data as NodeData;
  const router = useRouter();
  const open = () => router.push(d.href as never);

  const tierStyle: Record<Tier, string> = {
    theme: "border-l-4 bg-card",
    kr: "border bg-muted/30",
  };
  const tierLabel: Record<Tier, string> = {
    theme: "THEME (OKR)",
    kr: "ZIEL",
  };

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {/* Card is a div (not a button) so the collapse toggle can be a real
          nested button; body click + keyboard open the drawer (side-pane). */}
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={`flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-lg p-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring ${tierStyle[d.tier]}`}
        style={d.tier === "theme" ? { borderLeftColor: d.accent } : undefined}
      >
        <header className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            {d.hasChildren && (
              <button
                type="button"
                aria-label={d.collapsed ? "Teilbaum ausklappen" : "Teilbaum einklappen"}
                aria-expanded={!d.collapsed}
                onClick={(e) => {
                  e.stopPropagation();
                  d.onToggle(d.goalId);
                }}
                className="grid size-4 place-items-center rounded border text-[10px] leading-none hover:bg-muted"
              >
                {d.collapsed ? "▸" : "▾"}
              </button>
            )}
            {tierLabel[d.tier]}
          </span>
          <span className="flex items-center gap-1">
            {d.collapsed && d.descendantCount > 0 && (
              <span
                className="rounded-full bg-primary/15 px-1 py-0.5 text-[9px] font-semibold text-primary"
                title={`${d.descendantCount} verborgene Nachfahren`}
              >
                +{d.descendantCount}
              </span>
            )}
            {d.atRisk && (
              <span
                className="rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800"
                title="Run-Rate < 70 % vom Planned"
              >
                ⚠
              </span>
            )}
          </span>
        </header>
        <p className="line-clamp-2 text-[12px] font-semibold leading-tight">{d.title}</p>
        <div>
          <GoalStatusPill status={d.status} />
        </div>
        <ProgressBar value={d.progress} />
        <footer className="mt-auto flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate">
            {d.subgoalCount > 0 && `${d.subgoalCount} subgoal${d.subgoalCount === 1 ? "" : "s"}`}
            {d.subgoalCount > 0 && d.period && " · "}
            {d.period && goalPeriodLabel(d.period)}
          </span>
          {d.ownerInitial && (
            <span
              className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
              title="Owner"
            >
              {d.ownerInitial}
            </span>
          )}
        </footer>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.7 ? "bg-emerald-500/80" : value >= 0.3 ? "bg-amber-500/80" : "bg-rose-500/80";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {pct} %
      </span>
    </div>
  );
}

function buildGraph(
  themes: GoalNode[],
  collapsed: Set<string>,
  onToggle: (goalId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const rawNodes: Array<{ id: string; data: NodeData }> = [];
  const rawEdges: Array<{ id: string; source: string; target: string }> = [];

  // Rekursiver Walk über den Goal-Baum: ein Knoten je Ebene + Eltern-Kind-Kante.
  // Eingeklappte Knoten emittieren ihre Kinder nicht → dagre layoutet nur Sichtbares.
  const visit = (n: GoalNode, accent: string, parentGraphId: string | null): void => {
    // „kr"-Tier = messbarer Knoten (eigene Metrik); sonst Container-„theme".
    const tier: Tier = n.isMeasurable && n.progressMode !== "rollup" ? "kr" : "theme";
    const gid = nodeId(tier, n.id);
    const isCollapsed = collapsed.has(n.id);
    rawNodes.push({
      id: gid,
      data: {
        tier,
        goalId: n.id,
        title: n.title,
        status: n.status,
        progress: n.progress ?? (tier === "kr" ? krProgress(n) : trioProgress(n.trio)),
        subgoalCount: n.children.length > 0 ? n.children.length : n.kpiCount,
        period: n.period ?? null,
        ownerInitial: initialOf(n.ownerId),
        atRisk: isAtRisk(n.trio),
        href: `/ziele?entity=goal&id=${n.id}`,
        accent,
        hasChildren: n.children.length > 0,
        descendantCount: descendantCount(n),
        collapsed: isCollapsed,
        onToggle,
      },
    });
    if (parentGraphId) {
      rawEdges.push({ id: `${parentGraphId}__${gid}`, source: parentGraphId, target: gid });
    }
    if (!isCollapsed) for (const c of n.children) visit(c, accent, gid);
  };
  themes.forEach((t, ti) => visit(t, HUE_PALETTE[ti % HUE_PALETTE.length]!, null));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 64 });
  for (const n of rawNodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of rawEdges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const nodes: Node[] = rawNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "strategyNode",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: n.data,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
  }));

  return { nodes, edges };
}

function nodeId(tier: Tier, id: string): string {
  return `${tier}-${id}`;
}

/** Gesamtzahl der Nachfahren eines Knotens (für das „+N"-Collapse-Badge). */
function descendantCount(n: GoalNode): number {
  return n.children.reduce((sum, c) => sum + 1 + descendantCount(c), 0);
}

/** Alle Knoten-IDs mit Kindern (für „Alle einklappen"). */
function collapsibleIds(themes: GoalNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (n: GoalNode): void => {
    if (n.children.length > 0) {
      ids.add(n.id);
      n.children.forEach(walk);
    }
  };
  themes.forEach(walk);
  return ids;
}

function trioProgress(trio: RollupTrio): number {
  if (trio.planned <= 0) return 0;
  return Math.max(0, Math.min(1, trio.realized / trio.planned));
}

function krProgress(kr: GoalNode): number {
  if (kr.baseline == null || kr.target == null || kr.current == null) return 0;
  const span = kr.target - kr.baseline;
  if (span === 0) return kr.current === kr.target ? 1 : 0;
  return Math.max(0, Math.min(1, (kr.current - kr.baseline) / span));
}

function initialOf(ownerId: string | null): string {
  if (!ownerId) return "";
  return ownerId.slice(0, 2).toUpperCase();
}
