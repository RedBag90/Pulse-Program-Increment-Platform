import type { SnapshotPoint } from "@/server/views/transformation-cockpit";

interface Props {
  snapshots: SnapshotPoint[];
  /** Server-computed sparkline geometry for `snapshots` (same order/length). */
  points: { x: number; y: number }[];
  /** SVG canvas the points were mapped onto. */
  viewBox: { width: number; height: number };
}

/**
 * Lightweight SVG sparkline of the captured goal achievement — pure render,
 * no controls. The snapshot-capture button lives in the cockpit hero now;
 * this component just draws the line on the canvas the page-model prepared.
 * Single snapshots land at the right edge with a single dot.
 */
export function TransformationTrend({ snapshots, points, viewBox }: Props) {
  if (snapshots.length === 0) return null;

  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      className="h-12 w-full max-w-[280px]"
      preserveAspectRatio="none"
      role="img"
      aria-label="Verlauf der Zielerreichung"
    >
      {points.length > 1 && (
        <polyline
          points={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {points.map((p, i) => (
        <circle
          key={snapshots[i]!.capturedOn}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 1.5}
          className="fill-primary"
        />
      ))}
    </svg>
  );
}
