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
 * Min-€-Slider und Hover-Path-Highlighting kommen mit der naechsten
 * Welle — fuer V1 reicht der statische €-Fluss als visuelle
 * Investment-Story (Andrea/Stefan, V12 Klick-Pfade).
 */
interface Props {
  themes: ZieleTreeTheme[];
}

const COLUMN_X = [40, 280, 540, 800];
const COLUMN_WIDTH = 160;
const NODE_GAP = 6;
const MIN_NODE_HEIGHT = 14;
// Pixel pro Euro Planned — adaptiv unten gesetzt
const TARGET_TOTAL_HEIGHT = 640;

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  planned: number;
  realized: number;
  href?: string;
}

interface SankeyLink {
  fromIndex: number;
  toIndex: number;
  fromY: number;
  toY: number;
  height: number;
  color: string;
  drift: boolean;
}

export function StrategySankeyView({ themes }: Props) {
  if (themes.length === 0) {
    return (
      <div className="grid h-[300px] place-items-center rounded-lg border bg-muted/10 text-sm text-muted-foreground">
        Noch keine Themes — wechsle zum Tree-Layout und leg eines an.
      </div>
    );
  }

  // 1) Themes als Layer-0 Nodes
  const themeNodes: SankeyNode[] = themes.map((t) => ({
    id: t.id,
    label: t.title,
    sublabel: t.kind,
    color: t.color,
    planned: t.trio.planned,
    realized: t.trio.realized,
    href: `/ziele?entity=theme&id=${t.id}`,
  }));

  // 2) Objectives als Layer-1 + zugehoeriges Theme merken
  const objectiveNodes: Array<SankeyNode & { themeIndex: number }> = [];
  themes.forEach((t, ti) => {
    for (const o of t.objectives) {
      objectiveNodes.push({
        id: o.id,
        label: o.title,
        sublabel: o.period ?? "Backlog",
        color: t.color,
        planned: o.trio.planned,
        realized: o.trio.realized,
        href: `/ziele?entity=objective&id=${o.id}`,
        themeIndex: ti,
      });
    }
  });

  // 3) Key Results als Layer-2 + Theme-Color durchreichen
  const krNodes: Array<SankeyNode & { themeIndex: number; objIndex: number }> = [];
  themes.forEach((t, ti) => {
    t.objectives.forEach((o) => {
      const objIdx = objectiveNodes.findIndex((x) => x.id === o.id);
      for (const kr of o.keyResults) {
        krNodes.push({
          id: kr.id,
          label: kr.title,
          sublabel: `${Math.round(kr.trio.planned).toLocaleString("de-DE")} € Planned`,
          color: t.color,
          planned: kr.trio.planned,
          realized: kr.trio.realized,
          href: `/ziele?entity=kr&id=${kr.id}`,
          themeIndex: ti,
          objIndex: objIdx,
        });
      }
    });
  });

  // 4) Per Layer einen einheitlichen Pixel/€-Maßstab bestimmen
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

  // 5) Links Theme→Objective + Objective→KR berechnen
  // Strategie: jede Objective-Card erbt einen vertikalen „Slot" innerhalb
  // ihres Themes — der Y-Offset ist proportional zur kumulativen Hoehe
  // der vorigen Objectives desselben Themes.
  const themeYCursor = new Map<number, number>();
  const themeOLinks: SankeyLink[] = objLayout.map((o) => {
    const t = themeLayout[o.themeIndex];
    if (!t) throw new Error("missing theme layout");
    const cursor = themeYCursor.get(o.themeIndex) ?? 0;
    const fromYTop = t.y + cursor;
    themeYCursor.set(o.themeIndex, cursor + o.h);
    return {
      fromIndex: o.themeIndex,
      toIndex: 0,
      fromY: fromYTop,
      toY: o.y,
      height: o.h,
      color: o.color,
      drift: o.planned > 0 && o.realized / o.planned < 0.7,
    };
  });

  const objYCursor = new Map<number, number>();
  const objKrLinks: SankeyLink[] = krLayout.map((kr) => {
    const o = objLayout[kr.objIndex];
    if (!o) throw new Error("missing objective layout");
    const cursor = objYCursor.get(kr.objIndex) ?? 0;
    const fromYTop = o.y + cursor;
    objYCursor.set(kr.objIndex, cursor + kr.h);
    return {
      fromIndex: kr.objIndex,
      toIndex: 0,
      fromY: fromYTop,
      toY: kr.y,
      height: kr.h,
      color: kr.color,
      drift: kr.planned > 0 && kr.realized / kr.planned < 0.7,
    };
  });

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

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Band-Dicke = € Planned · Fuellung dunkelt mit Realized · gepunktet = Run-Rate &lt; 70 %.
        Klick auf einen Knoten oeffnet den Edit-Drawer.
      </p>
      <div className="overflow-auto rounded-lg border bg-card p-4">
        <svg
          viewBox={`0 0 960 ${totalHeight}`}
          className="block min-w-[960px] max-w-full"
          role="img"
          aria-label="Strategie-Sankey: Theme → Objective → Key Result"
        >
          <ColumnHeader x={COLUMN_X[0]!} label="THEMES" />
          <ColumnHeader x={COLUMN_X[1]!} label="OBJECTIVES" />
          <ColumnHeader x={COLUMN_X[2]!} label="KEY RESULTS" />

          {/* Theme → Objective Baender */}
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
            />
          ))}
          {/* Objective → KR Baender */}
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
            />
          ))}

          {/* Theme-Nodes */}
          {themeLayout.map((n) => (
            <NodeRect key={n.id} x={COLUMN_X[0]!} y={n.y} h={n.h} node={n} />
          ))}
          {/* Objective-Nodes */}
          {objLayout.map((n) => (
            <NodeRect key={n.id} x={COLUMN_X[1]!} y={n.y} h={n.h} node={n} />
          ))}
          {/* KR-Nodes */}
          {krLayout.map((n) => (
            <NodeRect key={n.id} x={COLUMN_X[2]!} y={n.y} h={n.h} node={n} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function NodeRect({ x, y, h, node }: { x: number; y: number; h: number; node: SankeyNode }) {
  const labelY = y + Math.min(14, h / 2 + 4);
  const sublabelY = labelY + 12;
  const content = (
    <g>
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
}: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  h: number;
  color: string;
  drift: boolean;
}) {
  // Cubic Bezier zwischen den Y-Slots, beide Seiten gleich hoch
  const cx = (x1 + x2) / 2;
  const d = `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${y2 + h} C${cx},${y2 + h} ${cx},${y1 + h} ${x1},${y1 + h} Z`;
  return (
    <path
      d={d}
      fill={color}
      opacity={drift ? 0.25 : 0.35}
      strokeDasharray={drift ? "4 3" : undefined}
      stroke={drift ? color : "none"}
      strokeWidth={drift ? 1 : 0}
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
