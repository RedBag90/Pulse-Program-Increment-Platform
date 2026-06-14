"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ZieleTreeTheme } from "@/server/views/ziele-view";

/**
 * Strategy-Map · Sankey-Layout (Konzept §4.1 / V1b). Hand-rolled SVG —
 * keine D3-Sankey-Lib, weil unsere Topologie strikt 3-stufig ist und
 * die Reihenfolge vorgegeben (Theme → Objective → KR). Bandbreite ist
 * proportional zu `trio.planned`; Fuellung dunkelt mit Realized/Planned
 * (≥ 70 % healthy, sonst gepunktet als Drift-Hinweis). Klick auf einen
 * Knoten oeffnet den Edit-Drawer (URL-State des Drawers).
 *
 * B3-Polish (Konzept §4.1):
 *   - **Min-€-Slider** filtert kleine Knoten (rechnet pxPerEuro neu)
 *   - **Hover-Path-Highlight** dimmt alles ausserhalb des Theme-Pfades
 */
interface Props {
  themes: ZieleTreeTheme[];
}

const COLUMN_X = [40, 280, 540, 800];
const COLUMN_WIDTH = 160;
const NODE_GAP = 6;
const MIN_NODE_HEIGHT = 14;
const TARGET_TOTAL_HEIGHT = 640;

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  planned: number;
  realized: number;
  themeIndex: number;
  href?: string;
}

interface SankeyLink {
  fromY: number;
  toY: number;
  height: number;
  color: string;
  drift: boolean;
  themeIndex: number;
}

export function StrategySankeyView({ themes }: Props) {
  const [hoverTheme, setHoverTheme] = useState<number | null>(null);
  const [minEur, setMinEur] = useState(0);

  // Schwellwert-Obergrenze: groesste Planned-€-Summe der Themes.
  // Damit der Slider sinnvoll skaliert, statt 1 €-Schritte zu erlauben.
  const sliderMax = useMemo(() => {
    let m = 0;
    for (const t of themes) m = Math.max(m, t.trio.planned);
    return Math.max(m, 1);
  }, [themes]);

  // 1) Themes als Layer-0 Nodes (gefiltert nach minEur)
  const themeNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (t.trio.planned < minEur) return;
    themeNodes.push({
      id: t.id,
      label: t.title,
      sublabel: t.kind,
      color: t.color,
      planned: t.trio.planned,
      realized: t.trio.realized,
      themeIndex: ti,
      href: `/ziele?entity=theme&id=${t.id}`,
    });
  });

  // 2) Objectives — nur fuer noch sichtbare Themes
  const visibleThemes = new Set(themeNodes.map((n) => n.themeIndex));
  const objectiveNodes: Array<SankeyNode & { objKey: string }> = [];
  themes.forEach((t, ti) => {
    if (!visibleThemes.has(ti)) return;
    for (const o of t.objectives) {
      if (o.trio.planned < minEur) continue;
      objectiveNodes.push({
        id: o.id,
        label: o.title,
        sublabel: o.period ?? "Backlog",
        color: t.color,
        planned: o.trio.planned,
        realized: o.trio.realized,
        themeIndex: ti,
        href: `/ziele?entity=objective&id=${o.id}`,
        objKey: o.id,
      });
    }
  });

  // 3) Key Results — Theme-Color durchreichen
  const visibleObjectives = new Set(objectiveNodes.map((n) => n.objKey));
  const krNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (!visibleThemes.has(ti)) return;
    for (const o of t.objectives) {
      if (!visibleObjectives.has(o.id)) continue;
      for (const kr of o.keyResults) {
        if (kr.trio.planned < minEur) continue;
        krNodes.push({
          id: kr.id,
          label: kr.title,
          sublabel: `${Math.round(kr.trio.planned).toLocaleString("de-DE")} € Planned`,
          color: t.color,
          planned: kr.trio.planned,
          realized: kr.trio.realized,
          themeIndex: ti,
          href: `/ziele?entity=kr&id=${kr.id}`,
        });
      }
    }
  });

  if (themeNodes.length === 0) {
    return (
      <div className="space-y-3">
        <Controls minEur={minEur} setMinEur={setMinEur} sliderMax={sliderMax} />
        <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
          Keine Knoten ueber dieser Schwelle — Slider zurueckziehen oder im Tree-Layout pflegen.
        </div>
      </div>
    );
  }

  // 4) pxPerEuro auf der gefilterten Menge neu berechnen
  const maxColumnSum = Math.max(
    sumPlanned(themeNodes),
    sumPlanned(objectiveNodes),
    sumPlanned(krNodes),
    1,
  );
  const pxPerEuro = TARGET_TOTAL_HEIGHT / maxColumnSum;

  function layoutColumn<T extends SankeyNode>(nodes: T[]): Array<T & { y: number; h: number }> {
    let y = 30;
    return nodes.map((n) => {
      const h = Math.max(MIN_NODE_HEIGHT, n.planned * pxPerEuro);
      const out = { ...n, y, h };
      y += h + NODE_GAP;
      return out;
    });
  }

  const themeLayout = layoutColumn(themeNodes);
  const objLayout = layoutColumn(objectiveNodes);
  const krLayout = layoutColumn(krNodes);

  // 5) Links: Slot-Position innerhalb des Eltern-Themes/Objectives kumulativ
  const themeYCursor = new Map<number, number>();
  const themeOLinks: SankeyLink[] = objLayout.map((o) => {
    const tIdx = themeLayout.findIndex((t) => t.themeIndex === o.themeIndex);
    const t = themeLayout[tIdx];
    if (!t) throw new Error("missing theme layout");
    const cursor = themeYCursor.get(o.themeIndex) ?? 0;
    const fromYTop = t.y + cursor;
    themeYCursor.set(o.themeIndex, cursor + o.h);
    return {
      fromY: fromYTop,
      toY: o.y,
      height: o.h,
      color: o.color,
      drift: o.planned > 0 && o.realized / o.planned < 0.7,
      themeIndex: o.themeIndex,
    };
  });

  // KR auf Objective abbilden — wir brauchen die Index-Suche auf objLayout
  const objIndexById = new Map(objLayout.map((o, i) => [o.id, i]));
  const objYCursor = new Map<number, number>();
  const objKrLinks: SankeyLink[] = krLayout
    .map((kr) => {
      // Welches Objective haengt am KR? Suche im Original-Tree.
      const owning = findObjectiveOf(themes, kr.id);
      if (!owning) return null;
      const objIdx = objIndexById.get(owning.id);
      if (objIdx == null) return null;
      const o = objLayout[objIdx];
      if (!o) return null;
      const cursor = objYCursor.get(objIdx) ?? 0;
      const fromYTop = o.y + cursor;
      objYCursor.set(objIdx, cursor + kr.h);
      return {
        fromY: fromYTop,
        toY: kr.y,
        height: kr.h,
        color: kr.color,
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
      objLayout[objLayout.length - 1]
        ? objLayout[objLayout.length - 1]!.y + objLayout[objLayout.length - 1]!.h
        : 0,
      krLayout[krLayout.length - 1]
        ? krLayout[krLayout.length - 1]!.y + krLayout[krLayout.length - 1]!.h
        : 0,
      200,
    ) + 30;

  const dim = (ti: number) => (hoverTheme == null || hoverTheme === ti ? 1 : 0.18);

  return (
    <div className="space-y-3">
      <Controls minEur={minEur} setMinEur={setMinEur} sliderMax={sliderMax} />
      <p className="text-[11px] text-muted-foreground">
        Band-Dicke = € Planned · Fuellung dunkelt mit Realized · gepunktet = Run-Rate &lt; 70 %.
        Hover auf einen Knoten hebt den Theme-Pfad an; Slider blendet kleine Knoten aus.
      </p>
      <div
        className="overflow-auto rounded-lg border bg-card p-4"
        onMouseLeave={() => setHoverTheme(null)}
      >
        <svg
          viewBox={`0 0 960 ${totalHeight}`}
          className="block min-w-[960px] max-w-full"
          role="img"
          aria-label="Strategie-Sankey: Theme → Objective → Key Result"
        >
          <ColumnHeader x={COLUMN_X[0]!} label="THEMES" />
          <ColumnHeader x={COLUMN_X[1]!} label="OBJECTIVES" />
          <ColumnHeader x={COLUMN_X[2]!} label="KEY RESULTS" />

          {themeOLinks.map((l, i) => (
            <BandPath
              key={`to-${i}`}
              x1={COLUMN_X[0]! + COLUMN_WIDTH}
              x2={COLUMN_X[1]!}
              y1={l.fromY}
              y2={l.toY}
              h={l.height}
              color={l.color}
              drift={l.drift}
              opacity={dim(l.themeIndex)}
            />
          ))}
          {objKrLinks.map((l, i) => (
            <BandPath
              key={`ok-${i}`}
              x1={COLUMN_X[1]! + COLUMN_WIDTH}
              x2={COLUMN_X[2]!}
              y1={l.fromY}
              y2={l.toY}
              h={l.height}
              color={l.color}
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
              opacity={dim(n.themeIndex)}
              onHover={setHoverTheme}
            />
          ))}
          {objLayout.map((n) => (
            <NodeRect
              key={n.id}
              x={COLUMN_X[1]!}
              y={n.y}
              h={n.h}
              node={n}
              opacity={dim(n.themeIndex)}
              onHover={setHoverTheme}
            />
          ))}
          {krLayout.map((n) => (
            <NodeRect
              key={n.id}
              x={COLUMN_X[2]!}
              y={n.y}
              h={n.h}
              node={n}
              opacity={dim(n.themeIndex)}
              onHover={setHoverTheme}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function Controls({
  minEur,
  setMinEur,
  sliderMax,
}: {
  minEur: number;
  setMinEur: (n: number) => void;
  sliderMax: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-[11px]">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground">Min €</span>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={Math.max(1, Math.round(sliderMax / 100))}
          value={minEur}
          onChange={(e) => setMinEur(Number(e.target.value))}
          className="h-1 w-48 cursor-pointer accent-primary"
        />
        <span className="tabular-nums">€{Math.round(minEur).toLocaleString("de-DE")}</span>
      </label>
      {minEur > 0 && (
        <button
          type="button"
          onClick={() => setMinEur(0)}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          zuruecksetzen
        </button>
      )}
    </div>
  );
}

function findObjectiveOf(themes: ZieleTreeTheme[], krId: string) {
  for (const t of themes) {
    for (const o of t.objectives) {
      if (o.keyResults.some((kr) => kr.id === krId)) return o;
    }
  }
  return null;
}

function NodeRect({
  x,
  y,
  h,
  node,
  opacity,
  onHover,
}: {
  x: number;
  y: number;
  h: number;
  node: SankeyNode;
  opacity: number;
  onHover: (ti: number | null) => void;
}) {
  const labelY = y + Math.min(14, h / 2 + 4);
  const sublabelY = labelY + 12;
  const content = (
    <g
      style={{ opacity, transition: "opacity 120ms ease" }}
      onMouseEnter={() => onHover(node.themeIndex)}
    >
      <rect x={x} y={y} width={COLUMN_WIDTH} height={h} rx={3} fill={node.color} opacity={0.85} />
      <rect
        x={x}
        y={y}
        width={COLUMN_WIDTH}
        height={h}
        rx={3}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
      />
      <text
        x={x + 6}
        y={labelY}
        className="fill-white text-[10px] font-medium"
        style={{ textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}
      >
        {truncate(node.label, 22)}
      </text>
      {h >= 28 && (
        <text x={x + 6} y={sublabelY} className="fill-white/80 text-[9px]">
          {truncate(node.sublabel, 24)}
        </text>
      )}
    </g>
  );
  if (!node.href) return content;
  return (
    <Link href={node.href as never} scroll={false}>
      <title>{`${node.label} — €${Math.round(node.planned).toLocaleString("de-DE")} Planned / €${Math.round(node.realized).toLocaleString("de-DE")} Realized`}</title>
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
  const baseOpacity = drift ? 0.25 : 0.35;
  return (
    <path
      d={d}
      fill={color}
      opacity={baseOpacity * opacity}
      strokeDasharray={drift ? "4 3" : undefined}
      stroke={drift ? color : "none"}
      strokeWidth={drift ? 1 : 0}
      style={{ transition: "opacity 120ms ease" }}
    />
  );
}

function ColumnHeader({ x, label }: { x: number; label: string }) {
  return (
    <text
      x={x}
      y={18}
      className="fill-muted-foreground text-[9px] uppercase tracking-wider"
      style={{ fontWeight: 600 }}
    >
      {label}
    </text>
  );
}

function sumPlanned(ns: SankeyNode[]): number {
  return ns.reduce((s, n) => s + Math.max(n.planned, 0), 0);
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
