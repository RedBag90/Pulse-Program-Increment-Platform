"use client";

import { useMemo } from "react";
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
import type { ZieleTreeKeyResult, ZieleTreeTheme } from "@/server/views/ziele-view";
import { isAtRisk, type RollupTrio } from "@/domain/goals-rollup";

/**
 * Strategie als Netzplan — flach (Refactor §Hierarchie-Vereinfachung).
 *
 * Top-Down xyflow + dagre: **Themes** (OKRs) oben, **KRs** darunter.
 * Knoten als Cards mit Title, Progress-Bar, Subgoal-Count, Periode +
 * Owner-Initiale. Klick = Deeplink nach `/strategy?entity=…&id=…`.
 *
 * Read-only — kein Drag-and-Drop, keine Inline-Edits.
 */
interface Props {
  themes: ZieleTreeTheme[];
}

type Tier = "theme" | "kr";

interface NodeData extends Record<string, unknown> {
  tier: Tier;
  title: string;
  progress: number;
  subgoalCount: number;
  period: string | null;
  ownerInitial: string;
  atRisk: boolean;
  href: string;
  accent: string;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;

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
  const { nodes, edges } = useMemo(() => buildGraph(themes), [themes]);

  if (nodes.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
        Noch keine Strategie definiert.
      </div>
    );
  }

  return (
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
  );
}

const NODE_TYPES = { strategyNode: StrategyNode };

function StrategyNode({ data }: NodeProps) {
  const d = data as NodeData;
  const router = useRouter();
  const onClick = () => router.push(d.href as never);

  const tierStyle: Record<Tier, string> = {
    theme: "border-l-4 bg-card",
    kr: "border bg-muted/30",
  };
  const tierLabel: Record<Tier, string> = {
    theme: "THEME (OKR)",
    kr: "KEY RESULT",
  };

  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <button
        type="button"
        onClick={onClick}
        className={`flex h-full w-full flex-col gap-1.5 rounded-lg p-3 text-left shadow-sm transition-shadow hover:shadow-md ${tierStyle[d.tier]}`}
        style={d.tier === "theme" ? { borderLeftColor: d.accent } : undefined}
      >
        <header className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{tierLabel[d.tier]}</span>
          {d.atRisk && (
            <span
              className="rounded-full bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-800"
              title="Run-Rate < 70 % vom Planned"
            >
              ⚠
            </span>
          )}
        </header>
        <p className="line-clamp-2 text-[12px] font-semibold leading-tight">{d.title}</p>
        <ProgressBar value={d.progress} />
        <footer className="mt-auto flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate">
            {d.subgoalCount > 0 && `${d.subgoalCount} subgoal${d.subgoalCount === 1 ? "" : "s"}`}
            {d.subgoalCount > 0 && d.period && " · "}
            {d.period}
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
      </button>
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

function buildGraph(themes: ZieleTreeTheme[]): { nodes: Node[]; edges: Edge[] } {
  const rawNodes: Array<{ id: string; data: NodeData }> = [];
  const rawEdges: Array<{ id: string; source: string; target: string }> = [];

  themes.forEach((t, ti) => {
    const accent = HUE_PALETTE[ti % HUE_PALETTE.length]!;
    rawNodes.push({
      id: nodeId("theme", t.id),
      data: {
        tier: "theme",
        title: t.title,
        progress: trioProgress(t.trio),
        subgoalCount: t.keyResults.length,
        period: t.period ?? null,
        ownerInitial: initialOf(t.ownerId),
        atRisk: isAtRisk(t.trio),
        href: `/strategy?entity=theme&id=${t.id}`,
        accent,
      },
    });
    for (const kr of t.keyResults) {
      rawNodes.push({
        id: nodeId("kr", kr.id),
        data: {
          tier: "kr",
          title: kr.title,
          progress: krProgress(kr),
          subgoalCount: kr.kpiCount,
          period: kr.metricUnit ?? null,
          ownerInitial: initialOf(kr.ownerId),
          atRisk: isAtRisk(kr.trio),
          href: `/strategy?entity=kr&id=${kr.id}`,
          accent,
        },
      });
      rawEdges.push({
        id: edgeId(t.id, kr.id),
        source: nodeId("theme", t.id),
        target: nodeId("kr", kr.id),
      });
    }
  });

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

function edgeId(a: string, b: string): string {
  return `e-${a}-${b}`;
}

function trioProgress(trio: RollupTrio): number {
  if (trio.planned <= 0) return 0;
  return Math.max(0, Math.min(1, trio.realized / trio.planned));
}

function krProgress(kr: ZieleTreeKeyResult): number {
  if (kr.baseline == null || kr.target == null || kr.current == null) return 0;
  const span = kr.target - kr.baseline;
  if (span === 0) return kr.current === kr.target ? 1 : 0;
  return Math.max(0, Math.min(1, (kr.current - kr.baseline) / span));
}

function initialOf(ownerId: string | null): string {
  if (!ownerId) return "";
  return ownerId.slice(0, 2).toUpperCase();
}
