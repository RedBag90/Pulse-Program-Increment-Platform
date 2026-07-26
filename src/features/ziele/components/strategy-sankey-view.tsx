"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GoalNode } from "@/server/views/ziele-view";
import { goalPeriodLabel } from "@/domain/goal-period";

/**
 * Strategy-Map · Sankey-Layout — flach (Refactor §Hierarchie-
 * Vereinfachung). Zwei Spalten: **Theme** (OKR-Statement) → **KR**.
 * Vision- und Strategic-Theme-Layer entfallen.
 *
 * Sizing:
 *   - €-Modus (Σ planned > 0): Knoten-Hoehe ~ trio.planned
 *   - Fallback-Modus (alles 0): Knoten gewichtet nach KR-Anzahl
 *
 * Interaktion:
 *   - Hover auf Knoten dimmt andere Pfade
 *   - Min-€-Slider filtert; pxPerWeight rechnet neu
 *   - Klick auf Knoten oeffnet den Pflege-Drawer (/strategy)
 */
interface Props {
  themes: GoalNode[];
}

const COLUMN_WIDTH = 240;
const COLUMN_PITCH = 400;
const COLUMN_X0 = 60;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 28;
const TARGET_TOTAL_HEIGHT = 720;

const colX = (depth: number): number => COLUMN_X0 + depth * COLUMN_PITCH;

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  planned: number;
  realized: number;
  weight: number;
  themeIndex: number;
  /** Tiefe im Baum (0 = Top-Level) → Sankey-Spalte. */
  depth: number;
  /** Eltern-Knoten-id (null bei Top-Level) — für die Band-Zuordnung. */
  parentId: string | null;
  /** DFS-Pre-Order für stabile, subtree-gruppierte Reihenfolge je Spalte. */
  order: number;
  href?: string;
}

interface PlacedNode extends SankeyNode {
  y: number;
  h: number;
}

interface SankeyLink {
  fromY: number;
  toY: number;
  fromDepth: number;
  height: number;
  drift: boolean;
  themeIndex: number;
}

export function StrategySankeyView({ themes }: Props) {
  const [hoverTheme, setHoverTheme] = useState<number | null>(null);
  const [minEur, setMinEur] = useState(0);

  const sliderMax = useMemo(() => {
    let m = 0;
    for (const t of themes) m = Math.max(m, t.trio.planned);
    return Math.max(m, 1);
  }, [themes]);

  const totalPlanned = useMemo(() => themes.reduce((s, t) => s + t.trio.planned, 0), [themes]);
  const fallbackMode = totalPlanned <= 0;

  // 1) Baum rekursiv zu Flach-Knoten mit Tiefe/Parent/DFS-Order. Ein Teilbaum
  //    wird beschnitten, sobald ein Knoten unter der €-Schwelle liegt.
  const flat: SankeyNode[] = [];
  let orderCounter = 0;
  const visit = (n: GoalNode, depth: number, parentId: string | null, themeIndex: number) => {
    if (!fallbackMode && n.trio.planned < minEur) return; // prune node + subtree
    const isLeaf = n.children.length === 0;
    const weight = fallbackMode ? (isLeaf ? 1 : Math.max(1, n.children.length)) : n.trio.planned;
    flat.push({
      id: n.id,
      label: n.title,
      sublabel:
        depth === 0
          ? n.period
            ? goalPeriodLabel(n.period)
            : ""
          : n.trio.planned > 0
            ? `€${compactEur(n.trio.planned)} Planned`
            : (n.metricUnit ?? ""),
      planned: n.trio.planned,
      realized: n.trio.realized,
      weight,
      themeIndex,
      depth,
      parentId,
      order: orderCounter++,
      href: `/strategy?entity=goal&id=${n.id}`,
    });
    for (const c of n.children) visit(c, depth + 1, n.id, themeIndex);
  };
  themes.forEach((t, ti) => visit(t, 0, null, ti));

  if (flat.length === 0) {
    return (
      <div className="space-y-3">
        <Controls
          minEur={minEur}
          setMinEur={setMinEur}
          sliderMax={sliderMax}
          disabled={fallbackMode}
        />
        <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
          Keine Knoten ueber dieser Schwelle — Slider zurueckziehen oder im Tree-Layout pflegen.
        </div>
      </div>
    );
  }

  // 2) Spalten nach Tiefe; je Spalte nach DFS-Order (Subtree-gruppiert).
  const maxDepth = flat.reduce((m, n) => Math.max(m, n.depth), 0);
  const columns: SankeyNode[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    columns[d] = flat.filter((n) => n.depth === d).sort((a, b) => a.order - b.order);
  }
  const maxColumnSum = Math.max(...columns.map(sumWeight), 1);
  const pxPerWeight = TARGET_TOTAL_HEIGHT / maxColumnSum;

  const placedById = new Map<string, PlacedNode>();
  const placedColumns: PlacedNode[][] = columns.map((col) => {
    let y = 40;
    return col.map((n) => {
      const h = Math.max(MIN_NODE_HEIGHT, n.weight * pxPerWeight);
      const placed: PlacedNode = { ...n, y, h };
      placedById.set(n.id, placed);
      y += h + NODE_GAP;
      return placed;
    });
  });

  // 3) Bänder Eltern→Kind über alle Ebenen; je Elternknoten ein y-Cursor.
  const parentCursor = new Map<string, number>();
  const links: SankeyLink[] = [];
  for (const col of placedColumns) {
    for (const child of col) {
      if (!child.parentId) continue;
      const parent = placedById.get(child.parentId);
      if (!parent) continue;
      const cursor = parentCursor.get(parent.id) ?? 0;
      links.push({
        fromY: parent.y + cursor,
        toY: child.y,
        fromDepth: parent.depth,
        height: child.h,
        drift: child.planned > 0 && child.realized / child.planned < 0.7,
        themeIndex: child.themeIndex,
      });
      parentCursor.set(parent.id, cursor + child.h);
    }
  }

  const totalHeight =
    Math.max(
      ...placedColumns.map((col) => {
        const last = col[col.length - 1];
        return last ? last.y + last.h : 0;
      }),
      240,
    ) + 30;
  const svgWidth = colX(maxDepth) + COLUMN_WIDTH + 40;

  const dim = (ti: number) => (hoverTheme == null || hoverTheme === ti ? 1 : 0.15);
  const themeColor = (ti: number) => HUE_PALETTE[ti % HUE_PALETTE.length]!;

  return (
    <div className="space-y-3">
      <Controls
        minEur={minEur}
        setMinEur={setMinEur}
        sliderMax={sliderMax}
        disabled={fallbackMode}
      />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <p>
          Band-Dicke ={" "}
          {fallbackMode ? (
            <>
              Anzahl Ziele · <span className="text-amber-600">noch keine €-Daten</span> — bindet
              KPIs an messbare Ziele, dann skaliert der Fluss nach Planned €.
            </>
          ) : (
            <>€ Planned · gepunktet = Run-Rate &lt; 70 %</>
          )}
        </p>
        <p>Hover hebt den Pfad an</p>
      </div>
      <div
        className="overflow-auto rounded-lg border bg-gradient-to-b from-card to-muted/20 p-4 shadow-inner"
        onMouseLeave={() => setHoverTheme(null)}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          className="block max-w-full"
          style={{ minWidth: svgWidth }}
          role="img"
          aria-label="Strategie-Sankey: Ziel-Kaskade"
        >
          <defs>
            <filter id="ziele-sankey-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
            </filter>
          </defs>

          {placedColumns.map((_, d) => (
            <ColumnHeader
              key={`h-${d}`}
              x={colX(d)}
              label={d === 0 ? "THEMES (OKRs)" : `EBENE ${d + 1}`}
            />
          ))}

          {links.map((l, i) => (
            <BandPath
              key={`l-${i}`}
              x1={colX(l.fromDepth) + COLUMN_WIDTH}
              x2={colX(l.fromDepth + 1)}
              y1={l.fromY}
              y2={l.toY}
              h={l.height}
              color={themeColor(l.themeIndex)}
              drift={l.drift}
              opacity={dim(l.themeIndex)}
            />
          ))}

          {placedColumns.flat().map((n) => (
            <NodeRect
              key={n.id}
              x={colX(n.depth)}
              y={n.y}
              h={n.h}
              node={n}
              tier={n.depth === 0 ? "theme" : "kr"}
              color={themeColor(n.themeIndex)}
              opacity={dim(n.themeIndex)}
              onHover={setHoverTheme}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

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

function Controls({
  minEur,
  setMinEur,
  sliderMax,
  disabled,
}: {
  minEur: number;
  setMinEur: (n: number) => void;
  sliderMax: number;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-[11px]">
      <label className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
        <span className="text-muted-foreground">Min €</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={Math.max(1, Math.round(sliderMax / 100))}
          value={minEur}
          disabled={disabled}
          onChange={(e) => setMinEur(Number(e.target.value))}
          className="h-1 w-48 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <span className="tabular-nums">€{Math.round(minEur).toLocaleString("de-DE")}</span>
      </label>
      {minEur > 0 && !disabled && (
        <button
          type="button"
          onClick={() => setMinEur(0)}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          zuruecksetzen
        </button>
      )}
      {disabled && (
        <span className="text-muted-foreground">— inaktiv, weil keine €-Daten gepflegt sind</span>
      )}
    </div>
  );
}

type Tier = "theme" | "kr";

function NodeRect({
  x,
  y,
  h,
  node,
  tier,
  color,
  opacity,
  onHover,
}: {
  x: number;
  y: number;
  h: number;
  node: SankeyNode;
  tier: Tier;
  color: string;
  opacity: number;
  onHover: (ti: number | null) => void;
}) {
  const fillOpacity = tier === "theme" ? 0.95 : 0.8;
  const labelClass =
    tier === "theme"
      ? "fill-white text-[12px] font-semibold"
      : "fill-white text-[11px] font-medium";
  const padX = 10;
  const labelY = y + Math.min(16, h / 2 + 4);
  const sublabelY = labelY + 13;
  const tooltip = `${node.label}\n€${Math.round(node.planned).toLocaleString(
    "de-DE",
  )} Planned · €${Math.round(node.realized).toLocaleString("de-DE")} Realized`;

  const content = (
    <g
      style={{ opacity, transition: "opacity 140ms ease" }}
      onMouseEnter={() => onHover(node.themeIndex)}
    >
      <rect
        x={x}
        y={y}
        width={COLUMN_WIDTH}
        height={h}
        rx={6}
        fill={color}
        opacity={fillOpacity}
        filter="url(#ziele-sankey-shadow)"
      />
      <rect
        x={x}
        y={y}
        width={COLUMN_WIDTH}
        height={h}
        rx={6}
        fill="none"
        stroke="rgba(0,0,0,0.12)"
      />
      <text
        x={x + padX}
        y={labelY}
        className={labelClass}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
      >
        {truncate(node.label, 30)}
      </text>
      {h >= 36 && node.sublabel && (
        <text
          x={x + padX}
          y={sublabelY}
          className="fill-white/85 text-[9px]"
          style={{ textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
        >
          {truncate(node.sublabel, 32)}
        </text>
      )}
    </g>
  );
  if (!node.href) return content;
  return (
    <Link href={node.href as never} scroll={false}>
      <title>{tooltip}</title>
      {content}
    </Link>
  );
}

function BandPath({
  x1,
  x2,
  y1,
  y2,
  h,
  color,
  drift,
  opacity,
}: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  h: number;
  color: string;
  drift: boolean;
  opacity: number;
}) {
  const cx = (x1 + x2) / 2;
  const d = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${y2 + h} C${cx},${y2 + h} ${cx},${y1 + h} ${x1},${y1 + h} Z`;
  const baseOpacity = drift ? 0.22 : 0.42;
  return (
    <path
      d={d}
      fill={color}
      opacity={baseOpacity * opacity}
      strokeDasharray={drift ? "5 4" : undefined}
      stroke={drift ? color : "none"}
      strokeWidth={drift ? 1.2 : 0}
      style={{ transition: "opacity 140ms ease" }}
    />
  );
}

function ColumnHeader({ x, label }: { x: number; label: string }) {
  return (
    <text
      x={x}
      y={22}
      className="fill-muted-foreground text-[10px] uppercase tracking-[0.15em]"
      style={{ fontWeight: 600 }}
    >
      {label}
    </text>
  );
}

function sumWeight(ns: Array<{ weight: number }>): number {
  return ns.reduce((s, n) => s + Math.max(n.weight, 0), 0);
}

function compactEur(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return Math.round(n).toLocaleString("de-DE");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
