import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
      {LIFECYCLE_STEPS.map((s) => (
        <div key={s.key} className="space-y-2 p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
              {s.gate}
            </span>
            <p className="font-heading text-sm font-semibold text-foreground">{t(s.labelKey)}</p>
          </div>
          <p className="max-w-[var(--reading-max-w)] text-sm leading-relaxed text-muted-foreground">
            {t(s.descriptionKey)}
          </p>
          <p className="text-xs text-muted-foreground">
            <span aria-hidden className="text-muted-foreground/70">
              ⌐
            </span>{" "}
            <span className="text-foreground">{t(s.milestone.labelKey)}</span> —{" "}
            {t(s.milestone.approverKey)}
          </p>
        </div>
      ))}
    </div>
  );
}
