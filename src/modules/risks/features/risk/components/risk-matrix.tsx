"use client";

import { useState } from "react";
import { RISK_LEVELS, type RiskLevel } from "@/modules/risks/domain/risk-matrix";
import { ROAM_HEX, ROAM_LABELS, ROAM_STATUSES } from "@/modules/core/kernel/domain/roam";
import type { MatrixCellCount, MatrixPlot } from "@/modules/risks/server/views/risks-list";
import { BAND_FILL, LEVEL_LABELS } from "@/modules/risks/features/risk/components/labels";

/** SVG geometry (viewBox units). */
const CELL = 64;
const PAD_LEFT = 150; // room for the rotated Y-title + level ticks
const PAD_BOTTOM = 90; // room for the X-ticks + X-title
const PAD_TOP = 10;
const PAD_RIGHT = 10;
const N = RISK_LEVELS.length; // 5

const xOf = (impact: RiskLevel) => PAD_LEFT + RISK_LEVELS.indexOf(impact) * CELL;
// Higher probability sits at the top.
const yOf = (probability: RiskLevel) => PAD_TOP + (N - 1 - RISK_LEVELS.indexOf(probability)) * CELL;

/** Deterministic in-cell offset so multiple dots in a cell don't fully overlap. */
function jitter(index: number): { dx: number; dy: number } {
  const cols = 4;
  const gx = index % cols;
  const gy = Math.floor(index / cols) % cols;
  const step = CELL / (cols + 1);
  return { dx: step * (gx + 1), dy: step * (gy + 1) };
}

interface Props {
  cells: MatrixCellCount[];
  plots: MatrixPlot[];
  emptyLabel?: string;
}

export function RiskMatrix({ cells, plots, emptyLabel = "Keine bewerteten Risiken." }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const width = PAD_LEFT + N * CELL + PAD_RIGHT;
  const height = PAD_TOP + N * CELL + PAD_BOTTOM;

  const perCell = new Map<string, MatrixPlot[]>();
  for (const p of plots) {
    const last = p.trail[p.trail.length - 1];
    if (!last) continue;
    const key = `${last.probability}:${last.impact}`;
    const list = perCell.get(key);
    if (list) list.push(p);
    else perCell.set(key, [p]);
  }

  const gridBottom = PAD_TOP + N * CELL;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto w-full max-w-2xl"
          role="img"
          aria-label="Risk-Matrix"
        >
          {/* cell backdrops — SVG needs `fill`, not `bg-*` */}
          {cells.map((c) => (
            <rect
              key={c.key}
              x={xOf(c.impact)}
              y={yOf(c.probability)}
              width={CELL}
              height={CELL}
              fill={BAND_FILL[c.band]}
              className="stroke-white/70"
              strokeWidth={1}
            />
          ))}

          {/* per-cell count badge (top-left corner of populated cells) */}
          {cells
            .filter((c) => c.count > 0)
            .map((c) => (
              <text
                key={`n-${c.key}`}
                x={xOf(c.impact) + 6}
                y={yOf(c.probability) + 14}
                className="fill-black/60 text-[10px] font-semibold"
              >
                {c.count}
              </text>
            ))}

          {/* X ticks (Impact) */}
          {RISK_LEVELS.map((lvl) => (
            <text
              key={`x-${lvl}`}
              x={xOf(lvl) + CELL / 2}
              y={gridBottom + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {LEVEL_LABELS[lvl]}
            </text>
          ))}
          {/* Y ticks (Probability) */}
          {RISK_LEVELS.map((lvl) => (
            <text
              key={`y-${lvl}`}
              x={PAD_LEFT - 10}
              y={yOf(lvl) + CELL / 2 + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {LEVEL_LABELS[lvl]}
            </text>
          ))}

          {/* X axis title */}
          <text
            x={PAD_LEFT + (N * CELL) / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-foreground text-[12px] font-medium"
          >
            Impact →
          </text>
          {/* Y axis title (rotated) */}
          <text
            transform={`rotate(-90 16 ${PAD_TOP + (N * CELL) / 2})`}
            x={16}
            y={PAD_TOP + (N * CELL) / 2}
            textAnchor="middle"
            className="fill-foreground text-[12px] font-medium"
          >
            Wahrscheinlichkeit →
          </text>

          {/* hovered risk: reveal the full reassessment trail */}
          {plots
            .filter((p) => p.riskId === hovered && p.trail.length > 1)
            .map((p) => (
              <g key={`trail-${p.riskId}`}>
                {p.trail.slice(0, -1).map((_pt, i) => {
                  const a = p.trail[i]!;
                  const b = p.trail[i + 1]!;
                  return (
                    <line
                      key={i}
                      x1={xOf(a.impact) + CELL / 2}
                      y1={yOf(a.probability) + CELL / 2}
                      x2={xOf(b.impact) + CELL / 2}
                      y2={yOf(b.probability) + CELL / 2}
                      stroke="#111827"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  );
                })}
                {p.trail.slice(0, -1).map((pt, i) => (
                  <circle
                    key={`ghost-${i}`}
                    cx={xOf(pt.impact) + CELL / 2}
                    cy={yOf(pt.probability) + CELL / 2}
                    r={6}
                    fill="none"
                    stroke="#111827"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                ))}
              </g>
            ))}

          {/* current-position dots, coloured by ROAM cluster */}
          {[...perCell.entries()].map(([cellId, cellPlots]) =>
            cellPlots.slice(0, 12).map((p, idx) => {
              const last = p.trail[p.trail.length - 1]!;
              const { dx, dy } = jitter(idx);
              const cx = xOf(last.impact) + dx;
              const cy = yOf(last.probability) + dy;
              const key = (
                p.roamStatus in ROAM_HEX ? p.roamStatus : "open"
              ) as keyof typeof ROAM_HEX;
              const hasTrail = p.trail.length > 1;
              return (
                <circle
                  key={`${cellId}-${p.riskId}`}
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={ROAM_HEX[key]}
                  stroke={hasTrail ? "#111827" : "white"}
                  strokeWidth={hasTrail ? 1.5 : 1}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(p.riskId)}
                  onMouseLeave={() => setHovered(null)}
                  tabIndex={0}
                  onFocus={() => setHovered(p.riskId)}
                  onBlur={() => setHovered(null)}
                >
                  <title>{p.displayNumber ?? "Risiko"}</title>
                </circle>
              );
            }),
          )}
        </svg>
      </div>

      {plots.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}

      {/* ROAM legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {ROAM_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: ROAM_HEX[s] }} />
            {ROAM_LABELS[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-foreground/60" />
          gestrichelt = Ausgangsbewertung (hover)
        </span>
      </div>
    </div>
  );
}
