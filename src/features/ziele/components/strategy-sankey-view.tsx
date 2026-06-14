"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ZieleTreeTheme } from "@/server/views/ziele-view";

/**
 * Strategy-Map · Sankey-Layout (Konzept §4.1 / V1b).
 *
 * Hand-rolled SVG mit drei Layern Theme → Objective → KR. Sizing-Logik:
 *
 *   - **€-Modus** (Summe planned > 0): Knoten-Hoehe proportional zu
 *     `trio.planned`, gleich Pulses €-Rollup-Story.
 *   - **Fallback-Modus** (alles 0): Knoten gewichtet nach Kind-Anzahl
 *     (Theme := Σ Objectives, Objective := Σ KRs, KR := 1). Damit fliesst
 *     der Sankey auch in Tenants ohne KPI-Bindungen und sieht nicht
 *     gestapelt-leblos aus.
 *
 * Wenn nur **ein Theme** existiert, springt jede Objective auf einen
 * Hue-Shift, damit die Baender visuell unterscheidbar bleiben. Bei
 * mehreren Themes dominiert die `theme.color`.
 *
 * Interaktion:
 *   - Hover auf Knoten dimmt alles ausserhalb des Theme-Pfades (0.18)
 *   - Min-€-Slider filtert kleine Knoten, pxPerEuro wird neu gerechnet
 *   - Klick auf Knoten oeffnet den Edit-Drawer (URL-State)
 */
interface Props {
  themes: ZieleTreeTheme[];
}

const COLUMN_X = [40, 320, 600, 880];
const COLUMN_WIDTH = 200;
const NODE_GAP = 10;
const MIN_NODE_HEIGHT = 28;
const TARGET_TOTAL_HEIGHT = 720;

interface SankeyNode {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  planned: number;
  realized: number;
  weight: number; // sizing weight (€ oder Count-Fallback)
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

  const sliderMax = useMemo(() => {
    let m = 0;
    for (const t of themes) m = Math.max(m, t.trio.planned);
    return Math.max(m, 1);
  }, [themes]);

  // Pre-Pass: existieren ueberhaupt €-Werte? Wenn nicht → Count-Fallback.
  const totalPlanned = useMemo(() => {
    let s = 0;
    for (const t of themes) s += t.trio.planned;
    return s;
  }, [themes]);
  const fallbackMode = totalPlanned <= 0;

  const showHueShift = themes.length === 1;

  // 1) Themes als Layer-0 Nodes (gefiltert nach minEur — nur im €-Modus)
  const themeNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (!fallbackMode && t.trio.planned < minEur) return;
    const weight = fallbackMode
      ? Math.max(
          1,
          t.objectives.reduce((s, o) => s + Math.max(1, o.keyResults.length), 0),
        )
      : t.trio.planned;
    themeNodes.push({
      id: t.id,
      label: t.title,
      sublabel: `${t.kind} · ${t.objectives.length} OKR`,
      color: t.color,
      planned: t.trio.planned,
      realized: t.trio.realized,
      weight,
      themeIndex: ti,
      href: `/ziele?entity=theme&id=${t.id}`,
    });
  });

  // 2) Objectives — nur fuer noch sichtbare Themes
  const visibleThemes = new Set(themeNodes.map((n) => n.themeIndex));
  const objectiveNodes: Array<SankeyNode & { objKey: string }> = [];
  themes.forEach((t, ti) => {
    if (!visibleThemes.has(ti)) return;
    t.objectives.forEach((o, oi) => {
      if (!fallbackMode && o.trio.planned < minEur) return;
      const objWeight = fallbackMode ? Math.max(1, o.keyResults.length) : o.trio.planned;
      objectiveNodes.push({
        id: o.id,
        label: o.title,
        sublabel: o.period ?? "Backlog",
        color: showHueShift ? shiftHue(t.color, (oi * 24) % 120) : t.color,
        planned: o.trio.planned,
        realized: o.trio.realized,
        weight: objWeight,
        themeIndex: ti,
        href: `/ziele?entity=objective&id=${o.id}`,
        objKey: o.id,
      });
    });
  });

  // 3) Key Results — Theme-Color durchreichen
  const visibleObjectives = new Set(objectiveNodes.map((n) => n.objKey));
  const krNodes: SankeyNode[] = [];
  themes.forEach((t, ti) => {
    if (!visibleThemes.has(ti)) return;
    t.objectives.forEach((o, oi) => {
      if (!visibleObjectives.has(o.id)) return;
      const objColor = showHueShift ? shiftHue(t.color, (oi * 24) % 120) : t.color;
      for (const kr of o.keyResults) {
        if (!fallbackMode && kr.trio.planned < minEur) continue;
        const krWeight = fallbackMode ? 1 : kr.trio.planned;
        krNodes.push({
          id: kr.id,
          label: kr.title,
          sublabel:
            kr.trio.planned > 0
              ? `€${compactEur(kr.trio.planned)} Planned`
              : (kr.metricUnit ?? "manuell"),
          color: objColor,
          planned: kr.trio.planned,
          realized: kr.trio.realized,
          weight: krWeight,
          themeIndex: ti,
          href: `/ziele?entity=kr&id=${kr.id}`,
        });
      }
    });
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

  // 4) Pixel/Weight-Skala auf den GROESSTEN Layer-Summen-Wert beziehen.
  const maxColumnSum = Math.max(
    sumWeight(themeNodes),
    sumWeight(objectiveNodes),
    sumWeight(krNodes),
    1,
  );
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
  const objLayout = layoutColumn(objectiveNodes);
  const krLayout = layoutColumn(krNodes);

  // Links: Slot-Position innerhalb des Eltern-Knotens kumulativ
  const themeYCursor = new Map<number, number>();
  const themeOLinks: SankeyLink[] = objLayout.map((o) => {
    const t = themeLayout.find((x) => x.themeIndex === o.themeIndex);
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

  const objIndexById = new Map(objLayout.map((o, i) => [o.id, i]));
  const objYCursor = new Map<number, number>();
  const objKrLinks: SankeyLink[] = krLayout
    .map((kr) => {
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
      240,
    ) + 30;

  const dim = (ti: number) => (hoverTheme == null || hoverTheme === ti ? 1 : 0.15);

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
              Anzahl Kinder · <span className="text-amber-600">noch keine €-Daten</span> — bindet
              KPIs an Key Results, dann skaliert der Fluss nach Planned €.
            </>
          ) : (
            <>€ Planned · Fuellung dunkelt mit Realized · gepunktet = Run-Rate &lt; 70 %</>
          )}
        </p>
        <p>Hover hebt den Theme-Pfad an</p>
      </div>
      <div
        className="overflow-auto rounded-lg border bg-gradient-to-b from-card to-muted/20 p-4 shadow-inner"
        onMouseLeave={() => setHoverTheme(null)}
      >
        <svg
          viewBox={`0 0 1120 ${totalHeight}`}
          className="block min-w-[1080px] max-w-full"
          role="img"
          aria-label="Strategie-Sankey: Theme → Objective → Key Result"
        >
          <defs>
            <filter id="ziele-sankey-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
            </filter>
          </defs>

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
              tier="theme"
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
              tier="objective"
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
              tier="kr"
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

function findObjectiveOf(themes: ZieleTreeTheme[], krId: string) {
  for (const t of themes) {
    for (const o of t.objectives) {
      if (o.keyResults.some((kr) => kr.id === krId)) return o;
    }
  }
  return null;
}

type Tier = "theme" | "objective" | "kr";

function NodeRect({
  x,
  y,
  h,
  node,
  tier,
  opacity,
  onHover,
}: {
  x: number;
  y: number;
  h: number;
  node: SankeyNode;
  tier: Tier;
  opacity: number;
  onHover: (ti: number | null) => void;
}) {
  // Tier-spezifische Typo + Fuell-Opazitaet
  const fillOpacity = tier === "theme" ? 0.95 : tier === "objective" ? 0.85 : 0.75;
  const labelClass =
    tier === "theme"
      ? "fill-white text-[12px] font-semibold"
      : tier === "objective"
        ? "fill-white text-[11px] font-medium"
        : "fill-white text-[10px] font-medium";
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
        fill={node.color}
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
        {truncate(node.label, tier === "theme" ? 26 : 24)}
      </text>
      {h >= 36 && (
        <text
          x={x + padX}
          y={sublabelY}
          className="fill-white/85 text-[9px]"
          style={{ textShadow: "0 1px 1px rgba(0,0,0,0.25)" }}
        >
          {truncate(node.sublabel, 28)}
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

/**
 * Hue-Shift fuer Hex-Farben, damit bei 1-Theme-Tenants die Objectives
 * trotzdem unterscheidbar bleiben. Idempotent gegen ungueltige Inputs
 * (return Original). Keine externe Color-Lib — handgerollt RGB→HSL→RGB.
 */
function shiftHue(hex: string, deltaDeg: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const raw = m[1]!;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + deltaDeg) % 360;
  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m2 = l - c / 2;
  let r2 = 0;
  let g2 = 0;
  let b2 = 0;
  if (h < 60) [r2, g2, b2] = [c, x, 0];
  else if (h < 120) [r2, g2, b2] = [x, c, 0];
  else if (h < 180) [r2, g2, b2] = [0, c, x];
  else if (h < 240) [r2, g2, b2] = [0, x, c];
  else if (h < 300) [r2, g2, b2] = [x, 0, c];
  else [r2, g2, b2] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m2) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}
