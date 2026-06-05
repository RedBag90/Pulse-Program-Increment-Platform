import { Target } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CockpitHero } from "@/features/transformation/components/cockpit-hero";
import { GoalCard } from "@/features/transformation/components/goal-card";
import { ActionDrawer } from "@/features/transformation/components/action-drawer";
import { StructureChipRow } from "@/features/transformation/components/structure-chip-row";
import { PracticesChipRow } from "@/features/transformation/components/practices-chip-row";
import type { OutcomeView } from "@/features/transformation/components/target-outcomes-manager";
import type { CockpitModel } from "@/server/views/transformation-cockpit";

interface Props {
  model: CockpitModel;
  canManage: boolean;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Outcome progress relative to its baseline → target band (clamped 0..1). */
function outcomeProgress(o: OutcomeView): number {
  const start = o.baseline ?? 0;
  const denom = o.target - start;
  if (denom === 0) return o.current != null ? 1 : 0;
  const cur = o.current ?? start;
  return Math.min(1, Math.max(0, (cur - start) / denom));
}

/**
 * Transformation cockpit — status board with action drawer.
 *
 * Top-left: hero with the single "Soll-Reife" number + long-window delta +
 * snapshot button. Below: strategic-goal cards in a RAG grid; each card
 * owns its inline actions (mark achieved, update KPI). Below the cards:
 * Struktur + Praktiken chip rows replace the four stacked-bar sections of
 * the old layout. Right column (≥ lg) is the persistent action drawer:
 * "Nächste Schritte" + "Seit letztem Snapshot" delta. Bottom: the goal-
 * unbound outcomes ("freie Outcomes") — unchanged shape, condensed display.
 *
 * The cockpit is empty (a single hint card) only when *nothing* renders —
 * no goals, no structure, no outcomes, no snapshots — which now also
 * implies no active target model.
 */
export function TransformationCockpit({ model: cockpit, canManage }: Props) {
  const { hero, model, goals, structure, practices, outcomes, trend, recentChanges, nextSteps } =
    cockpit;

  const empty =
    !hero.hasSnapshot &&
    goals.length === 0 &&
    structure.length === 0 &&
    practices.length === 0 &&
    outcomes.length === 0;

  if (empty) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Target className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Noch kein Zielzustand definiert. Sobald die Organisation Fortschritt erfasst, misst Pulse
          ihn hier.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column — status */}
      <div className="space-y-6">
        <CockpitHero hero={hero} model={model} trend={trend} canManage={canManage} />

        {goals.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-sm font-medium">Strategische Ziele</h2>
              <Link href="/transformation/ziele" className="text-xs text-primary hover:underline">
                Alle verwalten →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {goals.map((g) => (
                <GoalCard key={g.id} goal={g} canManage={canManage} />
              ))}
            </div>
          </section>
        )}

        {(structure.length > 0 || practices.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            <StructureChipRow structure={structure} />
            <PracticesChipRow practices={practices} />
          </div>
        )}

        {outcomes.length > 0 && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-heading text-sm font-medium">Outcomes (frei)</h2>
            <ul className="space-y-3">
              {outcomes.map((o) => {
                const unit = o.metricUnit ? ` ${o.metricUnit}` : "";
                return (
                  <li key={o.id} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{o.title}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {o.current ?? "—"} / {o.target}
                        {unit}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: pct(outcomeProgress(o)) }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Right column — action drawer (sticky on lg+) */}
      <ActionDrawer
        nextSteps={nextSteps}
        recentChanges={recentChanges}
        hasSnapshot={hero.hasSnapshot}
      />
    </div>
  );
}
