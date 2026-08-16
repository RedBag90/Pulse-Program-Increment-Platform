"use client";

import { useMemo } from "react";
import { EDGE_COLOR, NODE_W_COMPACT } from "@/modules/drumbeat/domain/graph-constants";
import { rankLayout } from "@/modules/drumbeat/domain/graph-layout";
import type { DependencyType } from "@/modules/drumbeat/domain/graph-scope";

interface Node {
  id: string;
  title: string;
  inPi: boolean;
  status: string;
}

interface Edge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
}

const NODE_W = NODE_W_COMPACT;
const NODE_H = 44;

export function DependencyGraph({ nodes, edges }: Props) {
  const { positions, width, height } = useMemo(() => rankLayout(nodes, edges), [nodes, edges]);

  if (nodes.length === 0 || edges.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border bg-muted/50 p-2">
      <svg width={width} height={Math.max(height, 100)} className="block">
        <defs>
          {(["blocks", "depends_on", "relates_to"] as const).map((type) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR[type] ?? "#9ca3af"} />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const from = positions.get(edge.fromId);
          const to = positions.get(edge.toId);
          if (!from || !to) return null;

          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const cx = (x1 + x2) / 2;
          const color = EDGE_COLOR[edge.type as DependencyType] ?? "#9ca3af";
          const isDirectional = edge.type !== "relates_to";

          return (
            <path
              key={edge.id}
              d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray={edge.type === "relates_to" ? "4 3" : undefined}
              markerEnd={isDirectional ? `url(#arrow-${edge.type})` : undefined}
              opacity={0.7}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isInPi = node.inPi;

          return (
            <g key={node.id}>
              <a href={`/feature/${node.id}`}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill={isInPi ? "#eff6ff" : "#f9fafb"}
                  stroke={isInPi ? "#3b82f6" : "#d1d5db"}
                  strokeWidth={1.5}
                  className="cursor-pointer hover:stroke-blue-500 transition-colors"
                />
                <title>{node.title}</title>
                <foreignObject x={pos.x + 6} y={pos.y + 4} width={NODE_W - 12} height={NODE_H - 8}>
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: "1.3",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      color: isInPi ? "#1d4ed8" : "#374151",
                      fontWeight: isInPi ? 600 : 400,
                    }}
                  >
                    {node.title}
                  </div>
                </foreignObject>
              </a>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-2 pb-1 mt-1">
        {(
          [
            { type: "blocks", label: "blocks" },
            { type: "depends_on", label: "depends on" },
            { type: "relates_to", label: "relates to" },
          ] as const
        ).map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <svg width={24} height={10}>
              <line
                x1={0}
                y1={5}
                x2={24}
                y2={5}
                stroke={EDGE_COLOR[type]}
                strokeWidth={1.5}
                strokeDasharray={type === "relates_to" ? "4 3" : undefined}
              />
            </svg>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <span className="text-[10px] text-muted-foreground/60 ml-auto">
          click a node to open feature
        </span>
      </div>
    </div>
  );
}
