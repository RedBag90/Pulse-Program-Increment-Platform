"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { RISK_LEVELS, type RiskLevel, type ExposureBand } from "@/modules/risks/domain/risk-matrix";
import {
  ROAM_HEX,
  ROAM_LABELS,
  ROAM_STATUSES,
  normalizeRoamStatus,
} from "@/modules/core/kernel/domain/roam";
import { EXPOSURE_LABEL, EXPOSURE_TONE, LEVEL_LABEL } from "@/modules/core/kernel/domain/exposure";
import { EmptyState } from "@/components/ui/empty-state";
import type { RoamStatus } from "@/modules/core/kernel/domain/roam";

/**
 * **Eine Form je Disposition — weil hier die Farbe allein steht.**
 *
 * Überall sonst trägt ROAM sein Wort (Pille, Chip, Legende). Auf dem Punkt nicht:
 * er ist 10 px gross, und in einer Zelle liegen bis zu zwölf davon nebeneinander.
 * Zwei der fünf Töne sind sich dabei besonders nah (`owned` 264°, `resolved` 277°
 * bei gleicher Helligkeit) — die Form entscheidet, nicht der Farbton (ADR-0021 §1).
 *
 * Der **gestrichelte** Ring bleibt der Ausgangsposition vorbehalten; `resolved`
 * ist deshalb ein durchgezogener Ring, kein gestrichelter.
 */
const ROAM_SHAPE: Record<RoamStatus, string> = {
  open: "rounded-full",
  owned: "rounded-[2px]",
  accepted: "rounded-[2px] rotate-45",
  mitigated: "[clip-path:polygon(50%_0%,100%_100%,0%_100%)]",
  resolved: "rounded-full border-[3px] border-current bg-transparent!",
};

/** Matrix-Render-Typen — lokal gehalten, damit die (weiterverwendete) Matrix
 *  nicht am gelöschten `risks-list`-View hängt. Die Issue-/Risk-Views formen
 *  ihre Plots strukturell auf diese Shape (Feld `riskId`). */
export interface MatrixPlot {
  riskId: string;
  displayNumber: string | null;
  title: string;
  roamStatus: string;
  /** inherent → each reassessment → current (empty when unscored). */
  trail: { probability: RiskLevel; impact: RiskLevel }[];
}
/**
 * Ein Feld des Rasters mit seinem Band. **Ohne Zahl**: die stand bis September
 * 2026 hier und wurde von der Fläche vor dem Rendern überschrieben, weil der
 * Server ungefiltert zählte und die Matrix gefiltert zeichnet. Gezählt wird
 * jetzt dort, wo gezeichnet wird — einmal.
 */
export interface MatrixCellCount {
  probability: RiskLevel;
  impact: RiskLevel;
  key: string;
  band: ExposureBand;
}

interface Props {
  cells: MatrixCellCount[];
  plots: MatrixPlot[];
  emptyLabel?: string;
}

/** Hover-Overlay: Tooltip-Anker + optionale Verbindungslinie (Pixel, relativ zum Container). */
type Overlay = {
  anchor: { x: number; y: number };
  line: { x1: number; y1: number; x2: number; y2: number } | null;
  plot: MatrixPlot;
  /** Breite des Positionierungs-Containers — begrenzt den Tooltip an den Raendern. */
  containerWidth: number;
};

const N = RISK_LEVELS.length; // 5
const cellKey = (probability: RiskLevel, impact: RiskLevel) => `${probability}:${impact}`;

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Risiko-Matrix (Eintritt × Auswirkung) als kompaktes Pastell-Raster: abgerundete
 * Zellen in Exposure-Band-Tönung, Achsen als Monospace-Labels (X oben, Y links,
 * hohe Wahrscheinlichkeit oben). Marker: hohler Ring = inherent, gefüllter Punkt
 * (ROAM-Farbe) = aktuell. Reines CSS-Grid — kein SVG.
 */
export function RiskMatrix({ cells, plots, emptyLabel = "Keine bewerteten Risiken." }: Props) {
  const { push: pushUrl } = useUrlState();
  const [hovered, setHovered] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Marker-Elemente vermessen (nicht die Zelle): der aktuelle Punkt + die
  // Ursprungs-Ghost je Issue liefern die exakten Kreis-Mitten für Linie/Tooltip.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const ghostRefs = useRef<Map<string, HTMLSpanElement | null>>(new Map());

  const cellByKey = new Map(cells.map((c) => [cellKey(c.probability, c.impact), c]));
  const currentByKey = new Map<string, MatrixPlot[]>();
  const ghostByKey = new Map<string, { plot: MatrixPlot; index: number }[]>();
  for (const p of plots) {
    const cur = p.trail[p.trail.length - 1];
    if (!cur) continue;
    push(currentByKey, cellKey(cur.probability, cur.impact), p);
    // Nur die Ausgangsposition (inherent) als EINEN Ghost — nicht jede
    // Zwischenbewertung, sonst mehrere Ringe für ein einziges Issue.
    if (p.trail.length > 1) {
      const origin = p.trail[0]!;
      push(ghostByKey, cellKey(origin.probability, origin.impact), { plot: p, index: 0 });
    }
  }

  // Overlay (Tooltip-Anker + Verbindungslinie) nach dem Hover-Commit vermessen —
  // so sind auch die nur-bei-Hover gerenderten Ghost-Ringe erfasst, ohne Flackern.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (hovered == null || !container) {
      setOverlay(null);
      return;
    }
    const plot = plots.find((p) => p.riskId === hovered);
    const dot = dotRefs.current.get(hovered);
    if (!plot || !dot) {
      setOverlay(null);
      return;
    }
    const cr = container.getBoundingClientRect();
    const center = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top };
    };
    const anchor = center(dot);
    let line: Overlay["line"] = null;
    if (plot.trail.length > 1) {
      const origin = ghostRefs.current.get(`${hovered}:0`);
      if (origin) {
        const o = center(origin);
        line = { x1: anchor.x, y1: anchor.y, x2: o.x, y2: o.y };
      }
    }
    setOverlay({ anchor, line, plot, containerWidth: cr.width });
  }, [hovered]);

  // Zeilen: hohe Wahrscheinlichkeit oben (RISK_LEVELS umgedreht).
  const rows = [...RISK_LEVELS].reverse();

  return (
    // `containerRef` sitzt auf der Karte, nicht im Scroll-Bereich: `overflow-x-auto`
    // rechnet `overflow-y` von `visible` auf `auto` hoch, der Container schnitte den
    // Hover-Tooltip also an beiden Raendern ab. Gemessen wird per
    // `getBoundingClientRect`, damit ein horizontaler Scroll automatisch drinsteckt.
    // Der Tour-Anker `risk-matrix` sitzt am **Streifen** der Fläche
    // (`issues-list-shell.tsx`), nicht hier: der steht auch zugeklappt im DOM,
    // diese Karte nicht. Zwei Elemente mit demselben Anker waren ein Übersehen
    // beim Streifen-Umbau.
    <div ref={containerRef} className="relative space-y-3 rounded-lg bg-card p-4 shadow-card">
      <div className="overflow-x-auto">
        {/* **Jeder Titel an seiner Achse.** Beide standen bis September 2026
            untereinander im Eck — dem einen Ort, der zu keiner der beiden Achsen
            gehört: zwei Zeilen auf 80 px, und die Pfeile zeigten ins Leere. Die
            Titel sind nötig, weil beide Skalen **dieselben fünf Wörter** tragen;
            die Pfeile sagen, wo es grösser wird. */}
        <div className="flex min-w-[22rem] gap-1.5">
          <div className="flex items-center">
            <span className="rotate-180 font-mono text-label tracking-[0.1em] text-muted-foreground [writing-mode:vertical-rl]">
              Wahrscheinlichkeit →
            </span>
          </div>
          <div
            role="img"
            aria-label="Risiko-Matrix (Eintrittswahrscheinlichkeit × Auswirkung)"
            className="grid flex-1 gap-1.5"
            style={{ gridTemplateColumns: `auto repeat(${N}, minmax(0, 1fr))` }}
          >
            {/* Erste Zeile: leeres Eck, daneben der X-Titel **über den fünf
                Datenspalten** — nicht über der Spalte der Zeilenköpfe, sonst
                sässe er zu weit links. */}
            <div aria-hidden />
            <div
              style={{ gridColumn: `2 / span ${N}` }}
              className="pb-0.5 text-center font-mono text-label tracking-[0.1em] text-muted-foreground"
            >
              Auswirkung →
            </div>

            {/* Das Eck der Skalen-Zeile bleibt leer: die Titel stehen jetzt aussen. */}
            <div aria-hidden />
            {RISK_LEVELS.map((impact) => (
              <div
                key={`x-${impact}`}
                className="pb-0.5 text-center font-mono text-label leading-tight text-muted-foreground"
              >
                {LEVEL_LABEL[impact]}
              </div>
            ))}

            {rows.map((probability) => (
              <Fragment key={`row-${probability}`}>
                <div className="flex items-center justify-end pr-1.5 font-mono text-label text-muted-foreground">
                  {LEVEL_LABEL[probability]}
                </div>
                {RISK_LEVELS.map((impact) => {
                  const key = cellKey(probability, impact);
                  const cell = cellByKey.get(key);
                  const currents = currentByKey.get(key) ?? [];
                  const ghosts = (ghostByKey.get(key) ?? []).filter(
                    (g) => g.plot.riskId === hovered,
                  );
                  const count = currents.length;
                  return (
                    <div
                      key={key}
                      // Feste Mindesthoehe statt `aspect-ratio`: die Zellen
                      // duerfen mit der Seitenbreite mitwachsen (die Matrix steht
                      // ueber der Tabelle und soll gleich breit sein), aber die
                      // Hoehe darf nicht daran haengen — sonst wird das Raster
                      // auf einer 1400px-Seite ueber 800px hoch. Waechst nur,
                      // wenn eine Zelle mehr Punkte fasst als eine Reihe traegt.
                      className={`relative flex min-h-16 flex-wrap content-center items-center justify-center gap-1 rounded-md p-1 ${
                        cell ? EXPOSURE_TONE[cell.band].cell : "bg-muted"
                      }`}
                    >
                      {count > 0 && (
                        <span className="absolute left-1 top-0.5 text-label font-semibold text-foreground/50">
                          {count}
                        </span>
                      )}
                      {/* vorige Position(en) — nur bei Hover: gestrichelter Ring */}
                      {ghosts.map(({ plot: p, index }) => (
                        <span
                          key={`g-${p.riskId}-${index}`}
                          ref={(el) => {
                            ghostRefs.current.set(`${p.riskId}:${index}`, el);
                          }}
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full border-2 border-dashed border-foreground/70 bg-transparent"
                        />
                      ))}
                      {/* aktuell = gefüllter Punkt in ROAM-Farbe (Hover: Details + Trail-Linie) */}
                      {currents.slice(0, 12).map((p) => {
                        const isHover = hovered === p.riskId;
                        return (
                          <button
                            key={`c-${p.riskId}`}
                            ref={(el) => {
                              dotRefs.current.set(p.riskId, el);
                            }}
                            type="button"
                            aria-label={`${p.title} öffnen`}
                            onClick={() => pushUrl({ issue: p.riskId })}
                            onMouseEnter={() => setHovered(p.riskId)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(p.riskId)}
                            onBlur={() => setHovered(null)}
                            className={`size-2.5 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                              ROAM_SHAPE[normalizeRoamStatus(p.roamStatus)]
                            } ${isHover ? "ring-2 ring-foreground/70" : ""}`}
                            style={{
                              // `color` trägt den Ring von `resolved` (border-current),
                              // `backgroundColor` die gefüllten Formen.
                              color: ROAM_HEX[normalizeRoamStatus(p.roamStatus)],
                              backgroundColor: ROAM_HEX[normalizeRoamStatus(p.roamStatus)],
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {overlay?.line && (
        <svg
          // mt-0!: `space-y-3` der Karte wuerde sonst auch dieses absolut
          // positionierte Kind um 12px nach unten schieben.
          className="pointer-events-none absolute inset-0 mt-0! h-full w-full text-foreground/70"
          aria-hidden
        >
          <line
            x1={overlay.line.x1}
            y1={overlay.line.y1}
            x2={overlay.line.x2}
            y2={overlay.line.y2}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </svg>
      )}
      {overlay && <MatrixTooltip overlay={overlay} cellByKey={cellByKey} />}

      {plots.length === 0 && <EmptyState title={emptyLabel} />}

      {/* Was das Bild zeigt — und was nicht: ein Punkt je Head-Issue. Die
          verschachtelten Issues zählen in ihrem Head, genau wie in der Tabelle
          darunter; ohne diesen Satz stünde die Zahl der Punkte unerklärt neben
          der Zahl im Seitenkopf. */}
      <p className="font-mono text-meta text-muted-foreground">
        Ein Zeichen je Head-Issue an seiner aktuellen Position · Kinder zählen in ihrem Head · Hover
        zeigt die Ausgangsposition · Zellfarbe = Exposure-Band
      </p>

      {/* ROAM-Legende: Form **und** Farbe, in derselben Paarung wie im Raster. */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {ROAM_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-2.5 ${ROAM_SHAPE[s]}`}
              style={{ color: ROAM_HEX[s], backgroundColor: ROAM_HEX[s] }}
            />
            {ROAM_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** `max-w-64` in Pixeln — Basis fuers Rand-Clamping. */
const TOOLTIP_MAX_W = 256;
/** Grober Hoehen-Richtwert; entscheidet nur, ob ueber oder unter den Punkt. */
const TOOLTIP_EST_H = 96;

/** Hover-Detailkarte am aktuellen Punkt: Titel · Nummer · ROAM · Band · Eintritt×Auswirkung. */
function MatrixTooltip({
  overlay,
  cellByKey,
}: {
  overlay: Overlay;
  cellByKey: Map<string, MatrixCellCount>;
}) {
  const p = overlay.plot;
  const cur = p.trail[p.trail.length - 1];
  const band = cur ? cellByKey.get(cellKey(cur.probability, cur.impact))?.band : undefined;
  const roam = normalizeRoamStatus(p.roamStatus);
  // Der Tooltip ist bis 16rem breit und steht normalerweise mittig ueber dem
  // Punkt. An den Raendern wuerde er aus der Karte laufen, in der obersten Zeile
  // nach oben heraus — deshalb hier einklemmen bzw. unter den Punkt klappen.
  const half = TOOLTIP_MAX_W / 2;
  const maxLeft = Math.max(half, overlay.containerWidth - half);
  const left = Math.min(Math.max(overlay.anchor.x, half), maxLeft);
  const above = overlay.anchor.y > TOOLTIP_EST_H;

  return (
    <div
      className={`pointer-events-none absolute z-20 mt-0! w-max max-w-64 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10 ${
        above ? "-translate-y-full" : ""
      }`}
      style={{ left, top: above ? overlay.anchor.y - 10 : overlay.anchor.y + 12 }}
    >
      <p className="font-medium text-foreground">{p.title}</p>
      {p.displayNumber && <p className="text-muted-foreground">{p.displayNumber}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: ROAM_HEX[roam] }} />
          {ROAM_LABELS[roam]}
        </span>
        {band && <span>· {EXPOSURE_LABEL[band]}</span>}
      </div>
      {cur && (
        <p className="mt-0.5 text-muted-foreground">
          {LEVEL_LABEL[cur.probability]} × {LEVEL_LABEL[cur.impact]}
        </p>
      )}
      {p.trail.length > 1 && (
        <p className="mt-0.5 text-muted-foreground">
          {p.trail.length - 1} Neubewertung(en) · Linie → Ausgangsposition
        </p>
      )}
    </div>
  );
}
