"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ZieleTreeTheme } from "@/server/views/ziele-view";

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
  themes: ZieleTreeTheme[];
}

const COLUMN_X = [60, 460];
const COLUMN_WIDTH = 240;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 28;
const TARGET_TOTAL_HEIGHT = 720;

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  planned: number;
  realized: number;
  weight: number;
  themeIndex: number;
  href?: string;
}

interface SankeyLink {
  fromY: number;
  toY: number;
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

  // 1) Themes (Layer 0)
  const themeNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (!fallbackMode && t.trio.planned < minEur) return;
    const weight = fallbackMode ? Math.max(1, t.keyResults.length) : t.trio.planned;
    themeNodes.push({
      id: t.id,
      label: t.title,
      sublabel: t.period ?? "",
      planned: t.trio.planned,
      realized: t.trio.realized,
      weight,
      themeIndex: ti,
      href: `/strategy?entity=theme&id=${t.id}`,
    });
  });

  // 2) KRs (Layer 1)
  const visibleThemes = new Set(themeNodes.map((n) => n.themeIndex));
  const krNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (!visibleThemes.has(ti)) return;
    for (const kr of t.keyResults) {
      if (!fallbackMode && kr.trio.planned < minEur) continue;
      const krWeight = fallbackMode ? 1 : kr.trio.planned;
      krNodes.push({
        id: kr.id,
        label: kr.title,
        sublabel:
          kr.trio.planned > 0
            ? `€${compactEur(kr.trio.planned)} Planned`
            : (kr.metricUnit ?? "manuell"),
        planned: kr.trio.planned,
        realized: kr.trio.realized,
        weight: krWeight,
        themeIndex: ti,
        href: `/strategy?entity=kr&id=${kr.id}`,
      });
    }
  });

  if (themeNodes.length === 0) {
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

  const maxColumnSum = Math.max(sumWeight(themeNodes), sumWeight(krNodes), 1);
  const pxPerWeight = TARGET_TOTAL_HEIGHT / maxColumnSum;

  function layoutColumn<T extends SankeyNode>(nodes: T[]): Array<T & { y: number; h: number }> {
    let y = 40;
    return nodes.map((n) => {
      const h = Math.max(MIN_NODE_HEIGHT, n.weight * pxPerWeight);
      const out = { ...n, y, h };
      y += h + NODE_GAP;
      return out;
    });
  }

  const themeLayout = layoutColumn(themeNodes);
  const krLayout = layoutColumn(krNodes);

  // Edges: KR → Theme via theme.keyResults Lookup
  const themeYCursor = new Map<number, number>();
  const themeKrLinks: SankeyLink[] = krLayout
    .map((kr) => {
      const themeLayoutIdx = themeLayout.findIndex((t) => t.themeIndex === kr.themeIndex);
      const t = themeLayout[themeLayoutIdx];
      if (!t) return null;
      const cursor = themeYCursor.get(kr.themeIndex) ?? 0;
      const fromYTop = t.y + cursor;
      themeYCursor.set(kr.themeIndex, cursor + kr.h);
      return {
        fromY: fromYTop,
        toY: kr.y,
        height: kr.h,
        drift: kr.planned > 0 && kr.realized / kr.planned < 0.7,
        themeIndex: kr.themeIndex,
      };
    })
    .filter((x): x is SankeyLink => x !== null);

  const totalHeight =
    Math.max(
      themeLayout[themeLayout.length - 1]
        ? themeLayout[themeLayout.length - 1]!.y + themeLayout[themeLayout.length - 1]!.h
        : 0,
      krLayout[krLayout.length - 1]
        ? krLayout[krLayout.length - 1]!.y + krLayout[krLayout.length - 1]!.h
        : 0,
      240,
    ) + 30;

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
              Anzahl KRs · <span className="text-amber-600">noch keine €-Daten</span> — bindet KPIs
              an Key Results, dann skaliert der Fluss nach Planned €.
            </>
          ) : (
            <>€ Planned · gepunktet = Run-Rate &lt; 70 %</>
          )}
        </p>
        <p>Hover hebt den Theme-Pfad an</p>
      </div>
      <div
        className="overflow-auto rounded-lg border bg-gradient-to-b from-card to-muted/20 p-4 shadow-inner"
        onMouseLeave={() => setHoverTheme(null)}
      >
        <svg
          viewBox={`0 0 760 ${totalHeight}`}
          className="block min-w-[760px] max-w-full"
          role="img"
          aria-label="Strategie-Sankey: Theme → Key Result"
        >
          <defs>
            <filter id="ziele-sankey-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
            </filter>
          </defs>

          <ColumnHeader x={COLUMN_X[0]!} label="THEMES (OKRs)" />
          <ColumnHeader x={COLUMN_X[1]!} label="KEY RESULTS" />

          {themeKrLinks.map((l, i) => (
            <BandPath
              key={`tk-${i}`}
              x1={COLUMN_X[0]! + COLUMN_WIDTH}
              x2={COLUMN_X[1]!}
              y1={l.fromY}
              y2={l.toY}
              h={l.height}
              color={themeColor(l.themeIndex)}
              drift={l.drift}
              opacity={dim(l.themeIndex)}
            />
          ))}

          {themeLayout.map((n) => (
            <NodeRect
              key={n.id}
              x={COLUMN_X[0]!}
              y={n.y}
              h={n.h}
              node={n}
              tier="theme"
              color={themeColor(n.themeIndex)}
              opacity={dim(n.themeIndex)}
              onHover={setHoverTheme}
            />
          ))}
          {krLayout.map((n) => (
            <NodeRect
              key={n.id}
              x={COLUMN_X[1]!}
              y={n.y}
              h={n.h}
              node={n}
              tier="kr"
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
