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
import { LEVEL_LABELS } from "@/modules/risks/features/risk/components/labels";
import { EXPOSURE_CELL, EXPOSURE_LABEL } from "@/modules/risks/features/lib/issue-badges";

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
export interface MatrixCellCount {
  probability: RiskLevel;
  impact: RiskLevel;
  key: string;
  band: ExposureBand;
  count: number;
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
    setOverlay({ anchor, line, plot });
  }, [hovered]);

  // Zeilen: hohe Wahrscheinlichkeit oben (RISK_LEVELS umgedreht).
  const rows = [...RISK_LEVELS].reverse();

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4" data-tour="risk-matrix">
      <div className="overflow-x-auto">
        <div ref={containerRef} className="relative min-w-[22rem]">
          <div
            role="img"
            aria-label="Risiko-Matrix (Eintritt × Auswirkung)"
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `auto repeat(${N}, minmax(0, 1fr))` }}
          >
            {/* Kopfzeile: leeres Eck + X-Spaltenköpfe (Auswirkung) */}
            <div />
            {RISK_LEVELS.map((impact) => (
              <div
                key={`x-${impact}`}
                className="pb-0.5 text-center font-mono text-[10px] leading-tight text-muted-foreground"
              >
                {LEVEL_LABELS[impact]}
              </div>
            ))}

            {rows.map((probability) => (
              <Fragment key={`row-${probability}`}>
                <div className="flex items-center justify-end pr-1.5 font-mono text-[10px] text-muted-foreground">
                  {LEVEL_LABELS[probability]}
                </div>
                {RISK_LEVELS.map((impact) => {
                  const key = cellKey(probability, impact);
                  const cell = cellByKey.get(key);
                  const currents = currentByKey.get(key) ?? [];
                  const ghosts = (ghostByKey.get(key) ?? []).filter(
                    (g) => g.plot.riskId === hovered,
                  );
                  const count = cell?.count ?? 0;
                  return (
                    <div
                      key={key}
                      className={`relative flex flex-wrap content-center items-center justify-center gap-1 rounded-md p-1 ${
                        cell ? EXPOSURE_CELL[cell.band] : "bg-muted"
                      }`}
                      style={{ aspectRatio: "1.7 / 1" }}
                    >
                      {count > 0 && (
                        <span className="absolute left-1 top-0.5 text-[10px] font-semibold text-foreground/50">
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
                            className={`size-2.5 shrink-0 cursor-pointer rounded-full ring-1 ring-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/70 ${
                              isHover ? "ring-2 ring-foreground/70" : ""
                            }`}
                            style={{ backgroundColor: ROAM_HEX[normalizeRoamStatus(p.roamStatus)] }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          {overlay?.line && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full text-foreground/70"
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
        </div>
      </div>

      {plots.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}

      <p className="font-mono text-[11px] text-muted-foreground">
        ● aktuell · Hover zeigt Details + gestrichelte Linie zur Ausgangsposition · Zelle =
        Exposure-Band-Farbe
      </p>

      {/* ROAM-Legende (die aktuellen Punkte sind ROAM-farbig) */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {ROAM_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: ROAM_HEX[s] }} />
            {ROAM_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

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
  return (
    <div
      className="pointer-events-none absolute z-20 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-3 py-2 text-xs shadow-md ring-1 ring-foreground/10"
      style={{ left: overlay.anchor.x, top: overlay.anchor.y - 10 }}
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
          {LEVEL_LABELS[cur.probability]} × {LEVEL_LABELS[cur.impact]}
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
