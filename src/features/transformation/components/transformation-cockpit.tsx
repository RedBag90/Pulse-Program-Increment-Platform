import { Link } from "@/i18n/navigation";
import { Target, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  deriveNextSteps,
  type StructureGap,
  type PracticeAdoption,
} from "@/server/services/transformation";
import type { OutcomeView } from "@/features/transformation/components/target-outcomes-manager";

interface Props {
  gap: StructureGap;
  adoption: PracticeAdoption;
  outcomes: OutcomeView[];
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
 * Transformation cockpit — shows how far the organisation is from the
 * management-defined target (Soll). Reads the structure gap; practice/outcome
 * gaps follow in later stories. Empty until a target is activated.
 */
export function TransformationCockpit({ gap, adoption, outcomes }: Props) {
  if (!gap.hasTarget && outcomes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Target className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Noch kein Zielzustand definiert. Lege fest, wohin sich die Organisation entwickeln soll —
          daran misst Pulse den Fortschritt.
        </p>
        <Link
          href="/transformation/ziel"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Zielzustand definieren <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const nextSteps = deriveNextSteps(gap, adoption);

  return (
    <div className="space-y-6">
      {/* Nächste Schritte — die Coaching-Schicht */}
      {gap.hasTarget &&
        (nextSteps.length > 0 ? (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-heading text-sm font-medium">Nächste Schritte zum Ziel</h2>
            <ul className="space-y-1.5">
              {nextSteps.map((step) => (
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
          </section>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Zielzustand erreicht — alle gemessenen Lücken geschlossen.
          </p>
        ))}

      {gap.hasTarget && (
        <>
          {/* Gesamtfortschritt (Struktur) */}
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-sm font-medium">Strukturfortschritt zum Ziel</h2>
              <span className="text-2xl font-semibold tabular-nums">
                {pct(gap.overallProgress)}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: pct(gap.overallProgress) }}
              />
            </div>
            {gap.targetDate && (
              <p className="mt-2 text-xs text-muted-foreground">
                Zieltermin: {gap.targetDate.toISOString().slice(0, 10)}
              </p>
            )}
          </section>

          {/* Struktur-Dimensionen */}
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-heading text-sm font-medium">Struktur (Ist / Soll)</h2>
            <ul className="space-y-3">
              {gap.dimensions.map((d) => (
                <li key={d.key} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {d.ist} / {d.soll ?? "—"}
                      {d.soll != null && d.ist < d.soll && (
                        <span className="ml-2 text-amber-600">noch {d.soll - d.ist}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: pct(d.progress) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {/* Praktik-Adoption */}
      {adoption.signals.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-heading text-sm font-medium">Praktiken (Adoption)</h2>
          <ul className="space-y-3">
            {adoption.signals.map((s) => (
              <li key={s.key} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted-foreground tabular-nums">{pct(s.value)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: pct(s.value) }} />
                </div>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Outcomes (Geschäftsziele) */}
      {outcomes.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-heading text-sm font-medium">Outcomes (Ist / Ziel)</h2>
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

      <Link
        href="/transformation/ziel"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Zielzustand bearbeiten <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
