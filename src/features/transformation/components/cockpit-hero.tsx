"use client";

import { useActionState } from "react";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { captureSnapshotAction } from "@/features/transformation/actions/transformation-snapshot";
import { TEMPLATE_LABELS } from "@/domain/operating-model";
import { Button } from "@/components/ui/button";
import { TransformationTrend } from "@/features/transformation/components/transformation-trend";
import type { HeroData, ModelSummary, TrendData } from "@/server/views/transformation-cockpit";

interface Props {
  hero: HeroData;
  model: ModelSummary | null;
  trend: TrendData;
  canManage: boolean;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Top-of-cockpit hero — the one headline number ("Soll-Reife"), the
 * long-window delta pill from the loaded trend, the target date, the active
 * operating-model template chip, and the snapshot-capture button. Drops the
 * dual 50% / 62% display the old cockpit had: only the snapshot metric is
 * shown here, and it's labelled as Soll-Reife so the scope is unambiguous.
 *
 * Client component because of the `<Button>` + `useActionState` for the
 * capture action; the rest of the hero is pure markup.
 */
export function CockpitHero({ hero, model, trend, canManage }: Props) {
  const [state, capture, capturing] = useActionState(captureSnapshotAction, {});
  const trending = hero.delta && hero.delta.value > 0;
  const trendingDown = hero.delta && hero.delta.value < 0;

  function snapshotNow() {
    capture(new FormData());
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Soll-Reife</p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="text-4xl font-semibold tabular-nums leading-none">
                {hero.hasSnapshot ? pct(hero.sollReife) : "—"}
              </span>
              {hero.delta && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    trending
                      ? "bg-emerald-50 text-emerald-700"
                      : trendingDown
                        ? "bg-amber-50 text-amber-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {trending ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trendingDown ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {hero.delta.value >= 0 ? "+" : ""}
                  {pct(hero.delta.value)} / {hero.delta.days} Tage
                </span>
              )}
            </p>
            {!hero.hasSnapshot && (
              <p className="mt-1 text-xs text-muted-foreground">
                Noch keine Erfassung — mit „Snapshot jetzt“ startet die Zeitreise.
              </p>
            )}
          </div>

          {model && (
            <div className="flex flex-col">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Zielmodell</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium">
                <Target className="h-3.5 w-3.5 text-primary" />
                {model.template ? TEMPLATE_LABELS[model.template] : "Eigenes Modell"}
              </p>
              {model.targetDate && (
                <p className="text-xs text-muted-foreground">Zieltermin {model.targetDate}</p>
              )}
            </div>
          )}
        </div>

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

      {hero.hasSnapshot && (
        <div className="mt-4">
          <TransformationTrend
            snapshots={trend.snapshots}
            points={trend.points}
            viewBox={trend.viewBox}
          />
          {trend.firstAchievement && (
            <p className="mt-2 text-xs text-muted-foreground">
              Meilenstein: erstes erreichtes Ziel am {trend.firstAchievement.capturedOn}.
            </p>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </section>
  );
}
