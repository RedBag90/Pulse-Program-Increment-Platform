"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  barMetrics,
  type GanttMonthSpan,
  type RoadmapRow,
  type RoadmapRowAccent,
} from "@/modules/work/domain/roadmap";
import { DEPENDENCY_TYPE_LABELS } from "@/modules/drumbeat/domain/status";

// RoadmapRow now lives in the domain roadmap view-model; re-exported so existing
// importers of the component keep working.
export type { RoadmapRow } from "@/modules/work/domain/roadmap";

export type GanttDependencyType = "blocks" | "depends_on" | "relates_to";

export interface GanttDependency {
  id: string;
  fromId: string;
  toId: string;
  type: GanttDependencyType;
  /** "from" / "to" wenn der entsprechende Endpunkt ausserhalb der
   *  gerenderten `rows` liegt; `null` wenn beide Endpunkte als Row
   *  vorhanden sind. */
  offScopeRole: "from" | "to" | null;
  /** Tooltip-Text fuer das Off-Scope-Marker (Titel des fehlenden Knotens). */
  offScopeLabel: string | null;
}

interface Props {
  rows: RoadmapRow[];
  axis: GanttMonthSpan;
  /**
   * Optional vertikale Anker auf der Zeitachse — z. B. PI-Grenzen. Linien
   * werden subtil gezeichnet; zwischen zwei Boundaries faerbt der Track
   * abwechselnd. Bleibt der Prop leer, ist die Sicht layout-identisch
   * mit der heutigen Generic-Roadmap.
   */
  piBoundaries?: ReadonlyArray<{ date: Date; label?: string }>;
  /** Feature-zu-Feature-Dependencies, MS-Project-Stil als Elbow-Pfeile
   *  ueber dem Track. Off-Scope-Edges werden als Bar-Rand-Marker
   *  gerendert. Andere Roadmaps setzen den Prop nicht und sehen die
   *  Sicht unveraendert. */
  dependencies?: readonly GanttDependency[];
  /** Klick auf eine Dep-Linie. Wenn nicht gesetzt, sind Linien nicht
   *  klickbar (read-only Default). Klick-Koordinaten in viewport-coords
   *  fuer Popover-Positionierung. */
  onDependencyClick?: (dep: GanttDependency, x: number, y: number) => void;
  /** Klick auf Bar-Hover-Plus. Wenn gesetzt, erscheint pro Feature-Bar bei
   *  Hover ein kleiner + Knopf rechts; Klick triggert diesen Handler. */
  onAddDependencyFrom?: (fromFeatureId: string, x: number, y: number) => void;
}

const MONTH_PX = 72;
const LABEL_W = 220;
const ROW_H = 28;

const EDGE_COLOR: Record<GanttDependencyType, string> = {
  blocks: "#ef4444",
  depends_on: "#d97706",
  relates_to: "#94a3b8",
};

const EDGE_DASH: Record<GanttDependencyType, string | undefined> = {
  blocks: undefined,
  depends_on: undefined,
  relates_to: "4 4",
};

// Ein Dependency-Vokabular (SSOT `domain/status`): kein „haengt ab" mehr.
const EDGE_LABEL = DEPENDENCY_TYPE_LABELS;

const HIGHLIGHT_OPACITY = 1;
const DIM_OPACITY = 0.45;
const FADE_OPACITY = 0.18;

/**
 * Generic roadmap Gantt — fester Label-Spalte links, Monatsachse rechts,
 * eine absolut positionierte Bar pro Row. Geteilt von Portfolio-, Value-
 * Stream-, ART- und Delivery-Cockpit-Roadmap; Bar-Positionen kommen aus
 * `@/domain/roadmap`.
 *
 * Visual-Polish 2026-06 (Cockpit-Folge): rounded-full Bars mit Gradient
 * und Schatten, sticky Header, Today-Linie, optionale PI-Grid-Linien
 * (`piBoundaries`) und optionaler Status-Akzent pro Row (`row.accent`).
 * Surfaces die weder `accent` noch `piBoundaries` setzen, sehen exakt
 * die alte Optik plus die crispere Bar-Behandlung.
 *
 * Dependencies (`dependencies` Prop): SVG-Overlay ueber dem Track,
 * elbow-routed Pfeile in Edge-Farbe; Hover auf einer Row hebt die
 * zugehoerigen Linien voll auf, Rest bleibt dezent. Off-Scope-Marker
 * sitzen als kleines Caret am Bar-Rand mit Tooltip.
 */
export function RoadmapGantt({
  rows,
  axis,
  piBoundaries,
  dependencies,
  onDependencyClick,
  onAddDependencyFrom,
}: Props) {
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);

  const trackWidth = axis.months.length * MONTH_PX;

  // Today-Marker erst nach Mount setzen — sonst produziert `new Date()`
  // im SSR-Render einen anderen Float-Wert als im Client-Render, was zu
  // Hydration-Mismatches im `left: ${pct}%` fuehrt. Konsequenz: Linie +
  // Pille erscheinen 1 Frame nach den Bars; unmerkbar, kein Layout-Shift.
  const [todayMarker, setTodayMarker] = useState<{ pct: number; label: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    const pct = pctOnAxis(now, axis);
    if (pct === null) {
      setTodayMarker(null);
      return;
    }
    setTodayMarker({ pct, label: now.toLocaleDateString("de-DE") });
  }, [axis]);
  const todayPct = todayMarker?.pct ?? null;
  const todayLabel = todayMarker?.label ?? "";
  const boundaryPcts = (piBoundaries ?? [])
    .map((b) => ({ pct: pctOnAxis(b.date, axis), label: b.label }))
    .filter((b) => b.pct !== null && b.pct > 0 && b.pct < 100) as Array<{
    pct: number;
    label: string | undefined;
  }>;

  // Hintergrund-Bands zwischen aufeinanderfolgenden Boundaries (alternating).
  const bandRanges = boundaryPcts.length > 0 ? buildBands(boundaryPcts.map((b) => b.pct)) : [];

  // Row-Index + Bar-Koordinaten pro Row vorberechnen — fuer Dep-Overlay
  // + Off-Scope-Marker. Die SVG-Overlay sitzt im selben relativen
  // Wrapper wie die Rows; y = i * ROW_H + ROW_H/2.
  const rowMeta = useMemo(() => {
    const indexById = new Map<string, number>();
    const barById = new Map<string, { x1: number; x2: number; y: number }>();
    rows.forEach((r, i) => {
      indexById.set(r.id, i);
      if (r.kind === "group") return;
      const bar = r.range ? barMetrics(r.range, axis) : null;
      if (!bar || bar.widthPct === 0) return;
      const x1 = (bar.leftPct / 100) * trackWidth;
      const x2 = ((bar.leftPct + bar.widthPct) / 100) * trackWidth;
      const y = i * ROW_H + ROW_H / 2;
      barById.set(r.id, { x1, x2, y });
    });
    return { indexById, barById };
  }, [rows, axis, trackWidth]);

  // Edges, deren beide Endpunkte als Bar bekannt sind — diese werden
  // als Pfade gerendert.
  const renderableDeps = useMemo(() => {
    if (!dependencies || dependencies.length === 0) return [];
    return dependencies.filter(
      (d) =>
        d.offScopeRole === null && rowMeta.barById.has(d.fromId) && rowMeta.barById.has(d.toId),
    );
  }, [dependencies, rowMeta.barById]);

  // Off-Scope-Edges: pro Feature aggregiert, fuer die Bar-Rand-Marker.
  const offScopeByFeature = useMemo(() => {
    const m = new Map<string, { left: GanttDependency[]; right: GanttDependency[] }>();
    if (!dependencies) return m;
    for (const d of dependencies) {
      if (d.offScopeRole === null) continue;
      // offScopeRole === "from" → der Source fehlt; der Marker
      // gehoert an die LINKE Seite der Target-Bar.
      // offScopeRole === "to"   → der Target fehlt; der Marker
      // gehoert an die RECHTE Seite der Source-Bar.
      const featureId = d.offScopeRole === "from" ? d.toId : d.fromId;
      if (!rowMeta.barById.has(featureId)) continue;
      const slot = m.get(featureId) ?? { left: [], right: [] };
      if (d.offScopeRole === "from") slot.left.push(d);
      else slot.right.push(d);
      m.set(featureId, slot);
    }
    return m;
  }, [dependencies, rowMeta.barById]);

  // Diagnose-Zaehler im Header — gibt dem User eine Erwartung, wie viele
  // Linien er sehen sollte. 0 → klar Daten-/Filter-Frage, nicht Render.
  const offScopeCount = useMemo(() => {
    let n = 0;
    for (const slot of offScopeByFeature.values()) n += slot.left.length + slot.right.length;
    return n;
  }, [offScopeByFeature]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Einträge.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div style={{ width: LABEL_W + trackWidth, minWidth: "100%" }}>
        {/* Month header — sticky am Top, dezenter Gradient, kompakter padding */}
        <div
          className="sticky top-0 z-20 flex border-b bg-gradient-to-b from-muted/60 to-muted/40
            shadow-[0_1px_0_var(--color-border)]"
        >
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center justify-between gap-2
              bg-gradient-to-b from-muted/60 to-muted/40 px-3 py-1.5 text-[11px] font-medium
              text-muted-foreground"
            style={{ width: LABEL_W }}
          >
            <span>Eintrag</span>
            {dependencies !== undefined && (
              <span
                className="text-[10px] font-normal text-muted-foreground/80"
                title="Dependencies im aktuellen Scope"
              >
                {renderableDeps.length === 0 && offScopeCount === 0
                  ? "keine Deps"
                  : `${renderableDeps.length} Deps${offScopeCount > 0 ? ` · ${offScopeCount} off` : ""}`}
              </span>
            )}
          </div>
          <div className="relative flex" style={{ width: trackWidth }}>
            {axis.months.map((m) => (
              <div
                key={m.key}
                className="shrink-0 border-l px-1.5 py-1.5 text-center text-[10px] font-medium
                  uppercase tracking-wide text-muted-foreground"
                style={{ width: MONTH_PX }}
              >
                {m.label}
              </div>
            ))}
            {/* Today-Pille klebt am Header rechts neben der Linie */}
            {todayPct !== null && (
              <div
                className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded-full
                  bg-rose-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide
                  text-white shadow-sm"
                style={{ left: `calc(${todayPct}% + 4px)` }}
                title={`Heute · ${todayLabel}`}
              >
                Heute
              </div>
            )}
          </div>
        </div>

        {/* Relative-Wrap fuer Rows + SVG-Dep-Overlay */}
        <div className="relative">
          {rows.map((row) => {
            if (row.kind === "group") {
              return (
                <div
                  key={row.id}
                  className="flex border-b bg-muted/30"
                  style={{ minHeight: ROW_H }}
                >
                  <div
                    className="sticky left-0 z-10 flex items-center bg-muted/30 px-3 text-[10px]
                      font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ width: LABEL_W }}
                  >
                    {row.label}
                  </div>
                  <div style={{ width: trackWidth }} />
                </div>
              );
            }

            const bar = row.range ? barMetrics(row.range, axis) : null;
            const derivedBar = row.derivedRange ? barMetrics(row.derivedRange, axis) : null;
            const accent = resolveAccent(row.accent ?? (row.kind as RoadmapRowAccent));
            const isEpic = row.kind === "epic";
            const offScope = offScopeByFeature.get(row.id);

            return (
              <div
                key={row.id}
                onMouseEnter={() => setHoverRowId(row.id)}
                onMouseLeave={() => setHoverRowId((p) => (p === row.id ? null : p))}
                className="group flex border-b transition-colors duration-100 last:border-b-0
                  hover:bg-muted/30"
                style={{ minHeight: ROW_H }}
              >
                <div
                  className="sticky left-0 z-10 flex shrink-0 flex-col justify-center bg-background
                    pr-3"
                  style={{ width: LABEL_W, paddingLeft: 12 + row.depth * 16 }}
                >
                  {row.href ? (
                    <Link
                      href={row.href}
                      className={`line-clamp-1 text-[13px] hover:underline ${
                        isEpic ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                      }`}
                      title={row.label}
                    >
                      {row.label}
                    </Link>
                  ) : (
                    <span
                      className={`line-clamp-1 text-[13px] ${
                        isEpic ? "font-semibold" : "font-medium"
                      }`}
                      title={row.label}
                    >
                      {row.label}
                    </span>
                  )}
                  {row.sublabel && (
                    <p
                      className="line-clamp-1 text-[9px] text-muted-foreground/70"
                      title={row.sublabel}
                    >
                      {row.sublabel}
                    </p>
                  )}
                </div>
                <div className="relative" style={{ width: trackWidth }}>
                  {/* PI-Bands (alternating background) — unter allen anderen Layern */}
                  {bandRanges.map((band, i) =>
                    i % 2 === 0 ? null : (
                      <div
                        key={`band-${i}`}
                        className="absolute inset-y-0 bg-muted/20"
                        style={{ left: `${band.start}%`, width: `${band.end - band.start}%` }}
                      />
                    ),
                  )}
                  {/* PI-Boundary-Linien — dezent gestrichelt */}
                  {boundaryPcts.map((b, i) => (
                    <div
                      key={`pi-line-${i}`}
                      className="absolute inset-y-0 border-l border-dashed border-border/60"
                      style={{ left: `${b.pct}%` }}
                      {...(b.label ? { title: b.label } : {})}
                    />
                  ))}
                  {/* Today-Linie */}
                  {todayPct !== null && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-px bg-rose-500/70"
                      style={{ left: `${todayPct}%` }}
                      title={`Heute · ${todayLabel}`}
                    />
                  )}

                  {/* Primary-Bar (Soll, oder Ist wenn kein Soll). h-2 = 8px,
                      der Standard fuer professionelle Roadmap-Tools. */}
                  {bar && bar.widthPct > 0 && (
                    <div
                      className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full
                        bg-gradient-to-b shadow-[0_1px_2px_rgba(0,0,0,0.08)]
                        transition-shadow group-hover:shadow-[0_2px_4px_rgba(0,0,0,0.12)] ${accent.bar}`}
                      style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: 6 }}
                      title={`${row.label}${derivedBar ? " — Soll" : ""}`}
                    />
                  )}
                  {/* Ist-Overlay (Epic-Roadmap) */}
                  {derivedBar && derivedBar.widthPct > 0 && (
                    <div
                      className="absolute bottom-1 h-1 rounded-full bg-primary/40"
                      style={{
                        left: `${derivedBar.leftPct}%`,
                        width: `${derivedBar.widthPct}%`,
                        minWidth: 4,
                      }}
                      title={`${row.label} — Ist (aus Features)`}
                    />
                  )}

                  {/* Off-Scope-Marker — sitzen am Bar-Rand */}
                  {offScope && bar && offScope.left.length > 0 && (
                    <OffScopeMarker
                      side="left"
                      pct={bar.leftPct}
                      deps={offScope.left}
                      featureLabel={row.label}
                    />
                  )}
                  {offScope && bar && offScope.right.length > 0 && (
                    <OffScopeMarker
                      side="right"
                      pct={bar.leftPct + bar.widthPct}
                      deps={offScope.right}
                      featureLabel={row.label}
                    />
                  )}

                  {/* Plus-Knopf am rechten Bar-Rand fuer „+ Dep". Nur
                      sichtbar wenn ein Callback gesetzt ist UND wenn die
                      Row eine Bar hat (Feature mit PI). Erscheint via
                      group-hover. */}
                  {onAddDependencyFrom && bar && bar.widthPct > 0 && row.kind === "feature" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddDependencyFrom(row.id, e.clientX, e.clientY);
                      }}
                      className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full border
                        border-background bg-primary text-[10px] font-bold leading-none text-primary-foreground
                        opacity-0 shadow transition-opacity group-hover:opacity-100"
                      style={{
                        left: `calc(${bar.leftPct + bar.widthPct}% + 4px)`,
                        width: 14,
                        height: 14,
                      }}
                      title="Dependency anlegen"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Dependency-SVG-Overlay — pointer-events disabled, sitzt
              ueber Bars aber unter den Sticky-Labels. Wird auch im
              Leerfall gerendert, damit das Element im Devtools-Tree
              greifbar bleibt und Daten-Diagnose einfach ist. */}
          {dependencies !== undefined && (
            <svg
              className="pointer-events-none absolute top-0 z-[5]"
              style={{
                left: LABEL_W,
                width: trackWidth,
                height: rows.length * ROW_H,
              }}
            >
              <defs>
                {(["blocks", "depends_on", "relates_to"] as GanttDependencyType[]).map((t) => (
                  <marker
                    key={`marker-${t}`}
                    id={`gantt-arrow-${t}`}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill={EDGE_COLOR[t]} />
                  </marker>
                ))}
              </defs>
              {renderableDeps.map((d) => {
                const s = rowMeta.barById.get(d.fromId)!;
                const t = rowMeta.barById.get(d.toId)!;
                const path = elbowPath(s, t);
                const highlighted = hoverRowId === d.fromId || hoverRowId === d.toId;
                const opacity =
                  hoverRowId === null
                    ? DIM_OPACITY
                    : highlighted
                      ? HIGHLIGHT_OPACITY
                      : FADE_OPACITY;
                const clickable = onDependencyClick !== undefined;
                return (
                  <path
                    key={d.id}
                    d={path}
                    fill="none"
                    stroke={EDGE_COLOR[d.type]}
                    strokeWidth={1.75}
                    strokeDasharray={EDGE_DASH[d.type]}
                    markerEnd={`url(#gantt-arrow-${d.type})`}
                    opacity={opacity}
                    onClick={
                      clickable
                        ? (e) => {
                            e.stopPropagation();
                            onDependencyClick!(d, e.clientX, e.clientY);
                          }
                        : undefined
                    }
                    style={{
                      transition: "opacity 120ms ease-out",
                      pointerEvents: clickable ? "stroke" : "none",
                      cursor: clickable ? "pointer" : undefined,
                    }}
                  >
                    <title>{`${EDGE_LABEL[d.type]}`}</title>
                  </path>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

interface OffScopeMarkerProps {
  side: "left" | "right";
  pct: number;
  deps: GanttDependency[];
  featureLabel: string;
}

function OffScopeMarker({ side, pct, deps, featureLabel }: OffScopeMarkerProps) {
  const labels = deps
    .map((d) => `${EDGE_LABEL[d.type]}: ${d.offScopeLabel ?? "(ausserhalb des Scopes)"}`)
    .join("\n");
  const dominantType = deps[0]!.type;
  return (
    <span
      className="pointer-events-auto absolute top-1/2 -translate-y-1/2 cursor-help text-[9px]
        font-semibold leading-none"
      style={{
        left: side === "left" ? `calc(${pct}% - 8px)` : `calc(${pct}% - 2px)`,
        color: EDGE_COLOR[dominantType],
      }}
      title={`${featureLabel}\n${labels}`}
    >
      {side === "left" ? "◂" : "▸"}
    </span>
  );
}

interface AccentClasses {
  bar: string;
}

function resolveAccent(accent: RoadmapRowAccent | "group"): AccentClasses {
  switch (accent) {
    case "approved":
      return { bar: "from-sky-400 to-sky-600" };
    case "in_progress":
      return { bar: "from-indigo-400 to-indigo-600" };
    case "blocked":
      return { bar: "from-amber-300 to-amber-500" };
    case "completed":
      return { bar: "from-emerald-400 to-emerald-600" };
    case "cancelled":
      return { bar: "from-slate-300 to-slate-500" };
    case "epic":
      return { bar: "from-indigo-500 to-indigo-700" };
    case "feature":
    default:
      return { bar: "from-sky-400 to-sky-600" };
  }
}

/**
 * Elbow-Routing (MS-Project-Stil): Source endet rechts, dann horizontal
 * zur halben Distanz, dann vertikal in die Target-Row, dann horizontal
 * an die linke Bar-Kante. Bei rueckwaerts gerichteten Edges (Target
 * beginnt vor Source endet) wird der gleiche Pfad gerendert — sieht
 * wie eine Schleife aus, aber bleibt funktional korrekt.
 */
function elbowPath(
  s: { x1: number; x2: number; y: number },
  t: { x1: number; x2: number; y: number },
): string {
  const mid = (s.x2 + t.x1) / 2;
  return `M ${s.x2} ${s.y} H ${mid} V ${t.y} H ${t.x1}`;
}

/**
 * Wo liegt `date` prozentual auf der Achse `[axis.start … axis.end]`?
 * Outside → `null`, damit der Caller die Linie ausblenden kann.
 */
function pctOnAxis(date: Date, axis: GanttMonthSpan): number | null {
  const t = date.getTime();
  const start = axis.start.getTime();
  const end = axis.end.getTime();
  if (end <= start) return null;
  if (t < start || t > end) return null;
  return ((t - start) / (end - start)) * 100;
}

/** Aus aufsteigenden Boundary-Prozenten Track-Bands `[0, b1, b2, …, 100]` formen. */
function buildBands(pcts: number[]): Array<{ start: number; end: number }> {
  const sorted = [...pcts].sort((a, b) => a - b);
  const stops = [0, ...sorted, 100];
  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < stops.length - 1; i++) {
    out.push({ start: stops[i]!, end: stops[i + 1]! });
  }
  return out;
}
