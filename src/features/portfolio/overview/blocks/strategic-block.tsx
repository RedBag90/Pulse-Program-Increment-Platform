import { Link } from "@/i18n/navigation";
import { Target, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PortfolioOverview } from "@/server/services/portfolio-overview";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Strategy block — answers "are we moving the dial we said we'd move?"
 * Headline with on-track ratio + Ø KPI progress, then every active goal with
 * its own progress bar so the picture is complete without a drill-down.
 */
export function StrategicBlock({ data }: { data: PortfolioOverview }) {
  const activeGoals = data.goals.filter((g) => g.status === "active");
  // Highest progress first; stable for ties.
  const ranked = [...activeGoals].sort((a, b) => b.progress - a.progress);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Strategischer Bezug</h2>
      </div>

      {activeGoals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine aktiven Ziele hinterlegt.{" "}
          <Link href="/transformation" className="text-primary hover:underline">
            Ziele anlegen →
          </Link>
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-light tabular-nums">
                {data.goalsOnTrack}
              </span>
              <span className="text-sm text-muted-foreground">
                / {activeGoals.length} Ziele on track
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ø {pct(data.goalAverageProgress)} KPI-Erreichung
            </p>
          </div>

          <ul className="space-y-2">
            {ranked.map((g) => {
              const widthPct = Math.max(0, Math.min(100, g.progress * 100));
              return (
                <li key={g.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <Link
                      href="/transformation"
                      className="truncate font-medium text-foreground hover:text-primary hover:underline"
                      title={g.title}
                    >
                      {g.title}
                    </Link>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {pct(g.progress)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        g.progress >= 0.5 ? "bg-primary/70" : "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Link
        href="/transformation"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Ziele <ArrowRight className="size-3" />
      </Link>
    </Card>
  );
}
