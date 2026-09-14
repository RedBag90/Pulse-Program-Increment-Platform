import { Link } from "@/i18n/navigation";
import { Target, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { isClosed } from "@/modules/core/goals/domain/goal-status";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Ein Fortschrittsbalken — Kopf-Ziel wie Unterziel, nur in zwei Größen. */
function GoalBar({ progress, sub = false }: { progress: number; sub?: boolean }) {
  const widthPct = Math.max(0, Math.min(100, progress * 100));
  return (
    <div className={`overflow-hidden rounded-full bg-muted ${sub ? "h-1" : "h-1.5"}`}>
      <div
        className={`h-full rounded-full ${
          progress >= 0.5 ? "bg-primary/70" : "bg-muted-foreground/40"
        } ${sub ? "opacity-70" : ""}`}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

/**
 * Strategy block — answers "are we moving the dial we said we'd move?"
 * Headline with on-track ratio + Ø KPI progress, then every active goal with
 * its own progress bar so the picture is complete without a drill-down.
 *
 * **Und darunter seine Unterziele.** Die Kachel zeigte bis September 2026 nur
 * die Kopf-Ziele — nicht, weil sie filterte, sondern weil die Übersicht den
 * Ziel-Baum an der Wurzel abschnitt. Ein Mandant mit einem Kopf-Ziel und zwei
 * Unterzielen sah „1 Ziel", und das las sich wie ein Fehler.
 *
 * Die Kopfzahl bleibt davon unberührt: „N / M Ziele on track" zählt weiterhin
 * die Kopf-Ziele. Unterziele mitzuzählen verschöbe eine Kennzahl, nach der
 * niemand gefragt hat.
 */
export function StrategicBlock({ data }: { data: PortfolioOverview }) {
  // In-flight = offen (on_track/at_risk/off_track) oder noch ohne Check-in
  // (null). Geschlossene Ziele (achieved/partial/missed/dropped) verschwinden
  // aus der Karte. Muss zum Builder-Prädikat `isInFlight = !isClosed` passen.
  const activeGoals = data.goals.filter((g) => !isClosed(g.status));
  // Highest progress first; stable for ties.
  const ranked = [...activeGoals].sort((a, b) => b.progress - a.progress);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <SectionLabel>Strategischer Bezug</SectionLabel>
      </div>

      {activeGoals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine aktiven Ziele hinterlegt.{" "}
          <Link href="/ziele" className="text-primary hover:underline">
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

          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {ranked.map((g) => (
              <li key={g.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <Link
                    href="/ziele"
                    className="truncate font-medium text-foreground hover:text-primary hover:underline"
                    title={g.title}
                  >
                    {g.title}
                  </Link>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {pct(g.progress)}
                  </span>
                </div>
                <GoalBar progress={g.progress} />

                {g.children.length > 0 && (
                  <ul className="space-y-1 border-l pl-3 pt-1">
                    {g.children.map((c) => (
                      <li key={c.id} className="space-y-0.5">
                        <div className="flex items-baseline justify-between gap-3 text-label">
                          <span className="truncate text-muted-foreground" title={c.title}>
                            {c.title}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            {pct(c.progress)}
                          </span>
                        </div>
                        <GoalBar progress={c.progress} sub />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/ziele"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Ziele <ArrowRight className="size-3" />
      </Link>
    </Card>
  );
}
