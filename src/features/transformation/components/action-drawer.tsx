import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { NextStep } from "@/server/services/transformation";
import type { RecentChange } from "@/domain/transformation-delta";

interface Props {
  nextSteps: NextStep[];
  recentChanges: RecentChange[];
  /** True if at least one snapshot exists — drives the "no comparison yet" copy. */
  hasSnapshot: boolean;
}

function pctSigned(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${Math.round(n * 100)}%`;
}

const LABEL_DE: Record<RecentChange["kind"], string> = {
  goal_achievement: "Soll-Reife",
  structure_progress: "Strukturfortschritt",
  achieved_goals: "Erreichte Ziele",
  goal_count: "Anzahl Ziele",
};

/**
 * Right-column drawer of the cockpit: persistent "Nächste Schritte" list +
 * "Seit letztem Snapshot" delta block. Both come from the page-model already
 * shaped, so this component is server-rendered and prop-only — no client
 * state.
 *
 * On lg+ screens it sits sticky on the right; below lg it folds beneath the
 * goal cards as a normal stacked section. The two subsections render their
 * own empty states so the drawer always has something meaningful to say.
 */
export function ActionDrawer({ nextSteps, recentChanges, hasSnapshot }: Props) {
  return (
    <aside className="space-y-6 lg:sticky lg:top-6">
      <NextStepsList steps={nextSteps} />
      <RecentChangesList changes={recentChanges} hasSnapshot={hasSnapshot} />
    </aside>
  );
}

function NextStepsList({ steps }: { steps: NextStep[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-heading text-sm font-medium">Nächste Schritte</h2>
      {steps.length === 0 ? (
        <p className="text-xs text-emerald-700">Keine offenen Lücken. Ziel ist in Reichweite.</p>
      ) : (
        <ul className="space-y-1.5">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                href={step.href}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{step.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentChangesList({
  changes,
  hasSnapshot,
}: {
  changes: RecentChange[];
  hasSnapshot: boolean;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 font-heading text-sm font-medium">Seit letztem Snapshot</h2>
      {!hasSnapshot ? (
        <p className="text-xs text-muted-foreground">
          Noch kein Snapshot — Vergleich erscheint nach der zweiten Erfassung.
        </p>
      ) : changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine nennenswerten Veränderungen.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {changes.map((c) => (
            <li key={c.kind} className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <DirectionIcon direction={c.direction} />
              <span className="flex-1">{LABEL_DE[c.kind]}</span>
              <span
                className={`tabular-nums ${
                  c.direction === "up"
                    ? "text-emerald-700"
                    : c.direction === "down"
                      ? "text-amber-700"
                      : "text-muted-foreground"
                }`}
              >
                {c.kind === "achieved_goals" || c.kind === "goal_count"
                  ? `${c.delta >= 0 ? "+" : ""}${c.delta}`
                  : pctSigned(c.delta)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DirectionIcon({ direction }: { direction: RecentChange["direction"] }) {
  if (direction === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
  if (direction === "down") return <TrendingDown className="h-3.5 w-3.5 text-amber-600" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}
