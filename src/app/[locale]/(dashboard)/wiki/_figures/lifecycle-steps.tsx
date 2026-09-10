import { LIFECYCLE_STEPS } from "@/modules/work/features/portfolio/lib/epic-lifecycle";

/**
 * **Die acht Abschnitte und die Tore dazwischen** — wer welchen Schritt abnimmt.
 *
 * Die Abnehmer stehen an `LIFECYCLE_STEPS.milestone.approver`, also dort, wo
 * die Zeitleiste am Epic sie auch hernimmt. Es sind die **Code-Vorgaben**; je
 * Wertstrom sind sie ueberschreibbar, und genau deshalb steht hier keine
 * zweite, handgepflegte Liste daneben.
 */
export function LifecycleSteps() {
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {LIFECYCLE_STEPS.map((s) => (
        <div key={s.key} className="space-y-2 p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              {s.gate}
            </span>
            <p className="font-heading text-sm font-semibold text-foreground">{s.label}</p>
          </div>
          <p className="max-w-[var(--reading-max-w)] text-[13.5px] leading-relaxed text-muted-foreground">
            {s.description}
          </p>
          <p className="text-[13px] text-muted-foreground">
            <span aria-hidden className="text-muted-foreground/70">
              ⌐
            </span>{" "}
            <span className="text-foreground">{s.milestone.label}</span> — {s.milestone.approver}
          </p>
        </div>
      ))}
    </div>
  );
}
