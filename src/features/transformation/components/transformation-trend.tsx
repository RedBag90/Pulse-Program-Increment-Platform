"use client";

import { useActionState } from "react";
import { TrendingUp } from "lucide-react";
import { captureSnapshotAction } from "@/features/transformation/actions/transformation-snapshot";
import { Button } from "@/components/ui/button";

/** One snapshot, serialised for the client. */
export interface SnapshotPoint {
  capturedOn: string; // YYYY-MM-DD
  goalAchievement: number; // 0..1
  achievedGoalCount: number;
  goalCount: number;
}

interface Props {
  snapshots: SnapshotPoint[];
  /** Server-computed sparkline geometry for `snapshots` (same order/length). */
  points: { x: number; y: number }[];
  /** SVG canvas the points were mapped onto. */
  viewBox: { width: number; height: number };
  canManage: boolean;
  /** The first day any goal was achieved — a milestone (TGT-020). */
  firstAchievement: { capturedOn: string } | null;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * "Zielerreichung über Zeit" — a lightweight SVG sparkline of the captured goal
 * achievement, plus a manual capture trigger. No charting library: the geometry
 * comes from the pure `sparklinePoints` helper.
 */
export function TransformationTrend({
  snapshots,
  points,
  viewBox,
  canManage,
  firstAchievement,
}: Props) {
  const [state, capture, capturing] = useActionState(captureSnapshotAction, {});

  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = snapshots.at(-1);
  const first = snapshots.at(0);
  const delta = last && first ? last.goalAchievement - first.goalAchievement : 0;

  function snapshotNow() {
    capture(new FormData());
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-heading text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />
          Zielerreichung über Zeit
        </h2>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={capturing}
            onClick={snapshotNow}
          >
            {capturing ? "Erfasst…" : "Snapshot jetzt"}
          </Button>
        )}
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch kein Verlauf erfasst. Mit „Snapshot jetzt“ startest du die Zeitreise; danach hält ein
          täglicher Job den Trend automatisch fest.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-4">
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
            <div className="shrink-0 text-right">
              <p className="text-2xl font-semibold tabular-nums leading-none">
                {pct(last!.goalAchievement)}
              </p>
              {snapshots.length > 1 && (
                <p
                  className={`text-xs tabular-nums ${
                    delta > 0
                      ? "text-emerald-600"
                      : delta < 0
                        ? "text-amber-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {delta >= 0 ? "+" : ""}
                  {pct(delta)} seit {first!.capturedOn}
                </p>
              )}
            </div>
          </div>

          {firstAchievement && (
            <p className="mt-3 text-xs text-muted-foreground">
              Meilenstein: erstes erreichtes Ziel am {firstAchievement.capturedOn}.
            </p>
          )}
        </>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
